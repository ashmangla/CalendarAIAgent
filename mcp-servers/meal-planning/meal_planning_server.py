#!/usr/bin/env python3
"""Meal Planning MCP Server (Python implementation).

This server exposes tools that generate meal plans using the Spoonacular API.
"""

import argparse
import asyncio
import json
import os
from datetime import datetime
from typing import Optional, Tuple

import requests

try:
    from mcp.server.fastmcp import FastMCP
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "mcp.server.fastmcp not found. Install the 'mcp' package in the Python "
        "environment used for the meal planning server."
    ) from exc


SPOONACULAR_API_KEY = os.getenv("SPOONACULAR_API_KEY", "")
SPOONACULAR_BASE_URL = "https://api.spoonacular.com"

# Debug logging for API key
import sys
if SPOONACULAR_API_KEY:
    print(f"✅ Spoonacular API key found (length: {len(SPOONACULAR_API_KEY)})", file=sys.stderr)
else:
    print("❌ Spoonacular API key NOT found in environment", file=sys.stderr)

mcp = FastMCP("MealPlanning")


def call_spoonacular(endpoint: str, params: dict) -> dict:
    if not SPOONACULAR_API_KEY:
        raise RuntimeError(
            "SPOONACULAR_API_KEY environment variable is not set."
        )

    params = {**params, "apiKey": SPOONACULAR_API_KEY}
    response = requests.get(f"{SPOONACULAR_BASE_URL}{endpoint}", params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def format_meal_plan(meal_plan: dict, preferences: dict) -> str:
    lines: list[str] = []

    event_date = preferences.get("eventDate")
    if event_date:
        try:
            readable_date = datetime.fromisoformat(event_date.replace("Z", "+00:00")).strftime(
                "%A, %B %d %Y"
            )
        except Exception:  # pragma: no cover - defensive
            readable_date = event_date
    else:
        readable_date = datetime.utcnow().strftime("%A, %B %d %Y")

    lines.append("WEEKLY MEAL PLAN")
    lines.append(f"Generated: {readable_date}\n")

    if preferences.get("familySize"):
        lines.append(f"Family Size: {preferences['familySize']}")
    if preferences.get("diet"):
        lines.append(f"Dietary Preference: {preferences['diet']}")
    if preferences.get("exclude"):
        lines.append(f"Exclusions: {preferences['exclude']}")
    if preferences.get("targetCalories"):
        lines.append(f"Daily Calorie Target: {preferences['targetCalories']}")
    lines.append("\n" + "=" * 50 + "\n")

    meals = meal_plan.get("meals")
    if isinstance(meals, list):
        grouped: dict[str, list[dict]] = {}
        for meal in meals:
            day = str(meal.get("day", "Unknown"))
            grouped.setdefault(day, []).append(meal)

        for day in sorted(grouped.keys()):
            lines.append(f"DAY {day}")
            lines.append("-" * 30)
            for meal in grouped[day]:
                lines.append(f"🍽️ {meal.get('title', 'Untitled Meal')}")
                if meal.get("readyInMinutes"):
                    lines.append(f"   Ready in: {meal['readyInMinutes']} minutes")
                if meal.get("servings"):
                    lines.append(f"   Servings: {meal['servings']}")
                if meal.get("id"):
                    lines.append(
                        f"   Recipe URL: https://spoonacular.com/recipes/-{meal['id']}"
                    )
                lines.append("")
            lines.append("")

    nutrients = meal_plan.get("nutrients")
    if nutrients:
        lines.append("=" * 50)
        lines.append("NUTRITION SUMMARY")
        lines.append("-" * 30)
        lines.append(f"Calories: {nutrients.get('calories', 'N/A')}")
        lines.append(f"Protein: {nutrients.get('protein', 'N/A')}g")
        lines.append(f"Fat: {nutrients.get('fat', 'N/A')}g")
        lines.append(f"Carbohydrates: {nutrients.get('carbohydrates', 'N/A')}g")

    items = meal_plan.get("items")
    if items:
        lines.append("\n" + "=" * 50)
        lines.append("GROCERY LIST")
        lines.append("-" * 30)
        for item in items:
            name = item.get("name", "Unnamed Item")
            aisle = item.get("aisle")
            if aisle:
                lines.append(f"☑ {name} ({aisle})")
            else:
                lines.append(f"☑ {name}")

    return "\n".join(lines).strip()


def _generate_meal_plan_internal(
    *,
    time_frame: str,
    target_calories: Optional[int],
    diet: Optional[str],
    exclude: Optional[str],
    family_size: Optional[int],
    event_date: Optional[str],
) -> Tuple[dict, str, Optional[dict]]:
    params = {"timeFrame": time_frame}
    if target_calories:
        params["targetCalories"] = target_calories
    if diet:
        params["diet"] = diet
    if exclude:
        params["exclude"] = exclude

    meal_plan = call_spoonacular("/mealplanner/generate", params)
    preferences = {
        "familySize": family_size,
        "targetCalories": target_calories,
        "diet": diet,
        "exclude": exclude,
        "eventDate": event_date,
    }
    doc_text = format_meal_plan(meal_plan, preferences)

    return meal_plan, doc_text, None


@mcp.tool()
async def generate_meal_plan(
    time_frame: str = "week",
    target_calories: Optional[int] = None,
    diet: Optional[str] = None,
    exclude: Optional[str] = None,
    family_size: Optional[int] = None,
    event_date: Optional[str] = None,
) -> str:
    """Generate a meal plan.

    Args:
        time_frame: 'day' or 'week'.
        target_calories: Target daily calories.
        diet: Diet preference string (e.g., 'vegetarian').
        exclude: Ingredients/allergens to exclude.
        family_size: Number of people to plan for (informational).
        event_date: ISO string for the associated event.

    Returns:
        JSON string containing the meal plan summary and formatted text.
    """

    if time_frame not in {"day", "week"}:
        raise ValueError("time_frame must be either 'day' or 'week'")

    try:
        meal_plan, doc_text, _ = _generate_meal_plan_internal(
            time_frame=time_frame,
            target_calories=target_calories,
            diet=diet,
            exclude=exclude,
            family_size=family_size,
            event_date=event_date,
        )
    except Exception as error:  # pragma: no cover - surfaced to MCP client
        raise RuntimeError(str(error)) from error

    preferences = {
        "familySize": family_size,
        "targetCalories": target_calories,
        "diet": diet,
        "exclude": exclude,
        "eventDate": event_date,
    }

    return json.dumps(
        {
            "mealPlan": meal_plan,
            "formattedText": doc_text,
            "document": None,
            "preferences": preferences,
        }
    )


async def main() -> None:
    async with mcp.run_stdio_server() as server:
        await server.wait_closed()


def run_cli() -> None:
    parser = argparse.ArgumentParser(description="Meal Planning generator CLI")
    parser.add_argument("--time-frame", default="week", choices=["day", "week"])
    parser.add_argument("--target-calories", type=int, default=None)
    parser.add_argument("--diet", default=None)
    parser.add_argument("--exclude", default=None)
    parser.add_argument("--family-size", type=int, default=None)
    parser.add_argument("--event-date", default=None)

    args = parser.parse_args()

    scriptPath = os.path.abspath(__file__)

    args_list = [
        scriptPath,
        '--time-frame', args.time_frame,
    ]

    if args.target_calories:
        args_list.extend(['--target-calories', str(args.target_calories)])
    if args.diet:
        args_list.extend(['--diet', args.diet])
    if args.exclude:
        args_list.extend(['--exclude', args.exclude])
    if args.family_size:
        args_list.extend(['--family-size', str(args.family_size)])
    if args.event_date:
        args_list.extend(['--event-date', args.event_date])

    meal_plan, doc_text, document_info = _generate_meal_plan_internal(
        time_frame=args.time_frame,
        target_calories=args.target_calories,
        diet=args.diet,
        exclude=args.exclude,
        family_size=args.family_size,
        event_date=args.event_date,
    )

    output = {
        "mealPlan": meal_plan,
        "formattedText": doc_text,
        "document": document_info,
        "preferences": {
            "familySize": args.family_size,
            "targetCalories": args.target_calories,
            "diet": args.diet,
            "exclude": args.exclude,
            "eventDate": args.event_date,
        },
    }
    print(json.dumps(output))


if __name__ == "__main__":
    if os.environ.get("MCP_RUN_MODE") == "server":
        try:
            asyncio.run(main())
        except KeyboardInterrupt:  # pragma: no cover
            pass
    else:
        run_cli()
