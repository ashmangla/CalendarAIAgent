/**
 * Tracks remaining checklist tasks for analyzed events so that we only show
 * unscheduled items when a user revisits the event. We intentionally avoid
 * storing the full analysis payload—only the unscheduled tasks plus the set of
 * completed task identifiers are kept in-memory.
 */

const deepCloneTasks = (tasks = []) => {
  try {
    return JSON.parse(JSON.stringify(tasks));
  } catch (error) {
    console.warn('taskCache: Failed to clone tasks', error);
    return Array.isArray(tasks) ? [...tasks] : [];
  }
};

const taskKey = (task) => {
  if (!task) {
    return null;
  }

  if (task.id) {
    return `id:${task.id}`;
  }

  const base = [
    task.task || '',
    task.category || '',
    task.description || '',
    task.estimatedTime || ''
  ]
    .map((part) => part.toString().trim().toLowerCase())
    .join('|');

  return `fallback:${base}`;
};

class TaskCache {
  constructor() {
    /**
     * Map<cacheKey, { remainingTasks: Array, completedTaskKeys: Set<string>, createdAt: number, updatedAt: number }>
     * cacheKey format: "userId:eventId" or just "eventId" for backward compatibility
     */
    this.cache = new Map();
  }

  /**
   * Generate cache key from user email and event ID
   * @param {string} eventId
   * @param {string} userEmail - Optional user email for multi-user support
   * @returns {string}
   */
  #getCacheKey(eventId, userEmail = null) {
    if (!eventId) {
      return null;
    }
    
    const eventKey = String(eventId);
    
    // If userEmail is provided, scope by user
    if (userEmail) {
      return `${userEmail}:${eventKey}`;
    }
    
    // Otherwise, use just eventId for backward compatibility
    return eventKey;
  }

  /**
   * Initialize or refresh the remaining tasks list for an event.
   * @param {string} eventId
   * @param {Array<object>} preparationTasks
   * @param {string} userEmail - Optional user email for multi-user support
   */
  setRemainingTasks(eventId, preparationTasks = [], userEmail = null) {
    if (!eventId) {
      return;
    }

    const key = this.#getCacheKey(eventId, userEmail);
    if (!key) {
      return;
    }

    const entry = this.cache.get(key);
    const clonedTasks = deepCloneTasks(preparationTasks);

    if (entry) {
      entry.remainingTasks = clonedTasks.filter((task) => {
        const identifier = taskKey(task);
        return identifier ? !entry.completedTaskKeys.has(identifier) : true;
      });
      entry.updatedAt = Date.now();
      return;
    }

    this.cache.set(key, {
      remainingTasks: clonedTasks,
      completedTaskKeys: new Set(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  /**
   * Return a cloned array of remaining tasks for the event.
   * @param {string} eventId
   * @param {string} userEmail - Optional user email for multi-user support
   * @returns {Array<object>|null}
   */
  getRemainingTasks(eventId, userEmail = null) {
    if (!eventId) {
      return null;
    }

    const key = this.#getCacheKey(eventId, userEmail);
    if (!key) {
      return null;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    return deepCloneTasks(entry.remainingTasks);
  }

  /**
   * Mark tasks as scheduled so they no longer show in the remaining list.
   * @param {string} eventId
   * @param {Array<object>} tasks
   * @param {string} userEmail - Optional user email for multi-user support
   */
  markTasksCompleted(eventId, tasks = [], userEmail = null) {
    if (!eventId || !Array.isArray(tasks) || tasks.length === 0) {
      return;
    }

    const key = this.#getCacheKey(eventId, userEmail);
    if (!key) {
      return;
    }

    let entry = this.cache.get(key);

    if (!entry) {
      entry = {
        remainingTasks: [],
        completedTaskKeys: new Set(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.cache.set(key, entry);
    }

    tasks.forEach((task) => {
      const identifier = taskKey(task);
      if (identifier) {
        entry.completedTaskKeys.add(identifier);
      }
    });

    entry.remainingTasks = entry.remainingTasks.filter((task) => {
      const identifier = taskKey(task);
      return identifier ? !entry.completedTaskKeys.has(identifier) : true;
    });

    entry.updatedAt = Date.now();
  }

  /**
   * How many tasks remain unscheduled for the event.
   * @param {string} eventId
   * @param {string} userEmail - Optional user email for multi-user support
   * @returns {number}
   */
  getRemainingCount(eventId, userEmail = null) {
    const key = this.#getCacheKey(eventId, userEmail);
    if (!key) {
      return 0;
    }

    const entry = this.cache.get(key);
    return entry ? entry.remainingTasks.length : 0;
  }

  /**
   * Remove cached data for a specific event.
   * @param {string} eventId
   * @param {string} userEmail - Optional user email for multi-user support
   */
  clear(eventId, userEmail = null) {
    if (!eventId) {
      return;
    }

    const key = this.#getCacheKey(eventId, userEmail);
    if (key) {
      this.cache.delete(key);
    }
  }

  /**
   * Clear the entire cache (useful for tests).
   */
  clearAll() {
    this.cache.clear();
  }
}

module.exports = new TaskCache();


