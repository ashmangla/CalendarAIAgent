class FareEstimator {
  constructor() {
    this.rideTypes = {
      uberx: {
        name: 'UberX',
        description: 'Affordable, everyday rides',
        capacity: 4,
        baseFare: 2.50,
        perMile: 1.15,
        perMinute: 0.25,
        minimumFare: 5.00
      },
      comfort: {
        name: 'Comfort',
        description: 'Newer cars with extra legroom',
        capacity: 4,
        baseFare: 3.50,
        perMile: 1.45,
        perMinute: 0.35,
        minimumFare: 7.00
      },
      xl: {
        name: 'UberXL',
        description: 'Larger vehicles for up to 6 people',
        capacity: 6,
        baseFare: 4.50,
        perMile: 1.85,
        perMinute: 0.45,
        minimumFare: 9.00
      },
      black: {
        name: 'Uber Black',
        description: 'Premium rides in luxury vehicles',
        capacity: 4,
        baseFare: 8.00,
        perMile: 2.75,
        perMinute: 0.65,
        minimumFare: 15.00
      },
      suv: {
        name: 'Uber SUV',
        description: 'Premium SUVs for up to 6 people',
        capacity: 6,
        baseFare: 12.00,
        perMile: 3.25,
        perMinute: 0.85,
        minimumFare: 25.00
      }
    };

    this.surgeAreas = {
      'airport': { multiplier: 1.5, reason: 'High demand at airport' },
      'downtown': { multiplier: 1.2, reason: 'Busy downtown area' },
      'times_square': { multiplier: 2.0, reason: 'Peak tourist area' },
      'stadium': { multiplier: 1.8, reason: 'Event venue surge pricing' }
    };
  }

  calculateAllFares(pickup, destination, requestedTime = null) {
    const distance = this.estimateDistance(pickup, destination);
    const duration = this.estimateDuration(distance, requestedTime);
    const surge = this.calculateSurge(pickup, destination, requestedTime);

    const estimates = {};

    for (const [rideType, config] of Object.entries(this.rideTypes)) {
      const baseFare = config.baseFare * surge.multiplier;
      const distanceFare = (distance * config.perMile) * surge.multiplier;
      const timeFare = (duration * config.perMinute) * surge.multiplier;
      
      let totalFare = baseFare + distanceFare + timeFare;
      totalFare = Math.max(totalFare, config.minimumFare * surge.multiplier);

      estimates[rideType] = {
        rideType: config.name,
        description: config.description,
        capacity: config.capacity,
        estimatedFare: parseFloat(totalFare.toFixed(2)),
        fareBreakdown: {
          baseFare: parseFloat(baseFare.toFixed(2)),
          distanceFare: parseFloat(distanceFare.toFixed(2)),
          timeFare: parseFloat(timeFare.toFixed(2)),
          surgeFare: surge.multiplier > 1 ? parseFloat((totalFare - (baseFare + distanceFare + timeFare) / surge.multiplier * (surge.multiplier - 1)).toFixed(2)) : 0,
          total: parseFloat(totalFare.toFixed(2))
        },
        estimatedDuration: `${duration} min`,
        estimatedDistance: `${distance.toFixed(1)} mi`,
        surgeInfo: surge.multiplier > 1 ? surge : null,
        estimatedArrival: this.calculateArrivalTime(requestedTime)
      };
    }

    return {
      success: true,
      pickup,
      destination,
      estimates,
      requestedTime: requestedTime || new Date().toISOString(),
      validUntil: new Date(Date.now() + 10 * 60000).toISOString() // Valid for 10 minutes
    };
  }

  estimateDistance(pickup, destination) {
    // Mock distance calculation based on location keywords
    const locationDistances = {
      'same_area': 2,
      'nearby': 5,
      'cross_town': 8,
      'airport': 15,
      'long_distance': 25
    };

    const pickupLower = pickup.toLowerCase();
    const destLower = destination.toLowerCase();

    // Airport trips
    if (pickupLower.includes('airport') || destLower.includes('airport')) {
      return locationDistances.airport + Math.random() * 5;
    }

    // Same neighborhood indicators
    if (this.isSameArea(pickupLower, destLower)) {
      return locationDistances.same_area + Math.random() * 2;
    }

    // Cross-town indicators
    if (this.isCrossTown(pickupLower, destLower)) {
      return locationDistances.cross_town + Math.random() * 5;
    }

    // Default nearby distance
    return locationDistances.nearby + Math.random() * 3;
  }

  estimateDuration(distance, requestedTime = null) {
    const baseTime = distance * 2.5; // ~2.5 minutes per mile in city traffic
    
    // Adjust for time of day
    const hour = requestedTime ? new Date(requestedTime).getHours() : new Date().getHours();
    let trafficMultiplier = 1.0;

    if (hour >= 7 && hour <= 9) trafficMultiplier = 1.5; // Morning rush
    else if (hour >= 17 && hour <= 19) trafficMultiplier = 1.4; // Evening rush
    else if (hour >= 22 || hour <= 5) trafficMultiplier = 0.8; // Late night/early morning

    return Math.ceil(baseTime * trafficMultiplier);
  }

  calculateSurge(pickup, destination, requestedTime = null) {
    let maxSurge = { multiplier: 1.0, reason: null };

    // Check for surge areas
    for (const [area, surge] of Object.entries(this.surgeAreas)) {
      if (pickup.toLowerCase().includes(area) || destination.toLowerCase().includes(area)) {
        if (surge.multiplier > maxSurge.multiplier) {
          maxSurge = surge;
        }
      }
    }

    // Time-based surge
    const hour = requestedTime ? new Date(requestedTime).getHours() : new Date().getHours();
    const day = requestedTime ? new Date(requestedTime).getDay() : new Date().getDay();

    // Weekend nights
    if ((day === 5 || day === 6) && (hour >= 22 || hour <= 2)) {
      const weekendSurge = { multiplier: 1.6, reason: 'Weekend night demand' };
      if (weekendSurge.multiplier > maxSurge.multiplier) {
        maxSurge = weekendSurge;
      }
    }

    // Rush hour surge
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      const rushSurge = { multiplier: 1.3, reason: 'Rush hour demand' };
      if (rushSurge.multiplier > maxSurge.multiplier) {
        maxSurge = rushSurge;
      }
    }

    return maxSurge;
  }

  calculateArrivalTime(requestedTime = null) {
    const baseTime = requestedTime ? new Date(requestedTime) : new Date();
    const waitTime = Math.random() * 8 + 2; // 2-10 minutes wait time
    
    return new Date(baseTime.getTime() + waitTime * 60000).toISOString();
  }

  isSameArea(pickup, destination) {
    const areas = [
      ['downtown', 'financial', 'wall street'],
      ['times square', 'theater', 'midtown'],
      ['brooklyn', 'williamsburg', 'prospect'],
      ['queens', 'astoria', 'long island city'],
      ['upper east', 'upper west', 'central park']
    ];

    return areas.some(area => 
      area.some(keyword => pickup.includes(keyword)) &&
      area.some(keyword => destination.includes(keyword))
    );
  }

  isCrossTown(pickup, destination) {
    const crossTownIndicators = [
      ['east', 'west'],
      ['uptown', 'downtown'],
      ['manhattan', 'brooklyn'],
      ['manhattan', 'queens']
    ];

    return crossTownIndicators.some(([area1, area2]) =>
      (pickup.includes(area1) && destination.includes(area2)) ||
      (pickup.includes(area2) && destination.includes(area1))
    );
  }

  getRideTypeInfo() {
    return {
      success: true,
      rideTypes: this.rideTypes
    };
  }
}

module.exports = FareEstimator;