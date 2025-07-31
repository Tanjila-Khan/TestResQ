const axios = require('axios');

// Cache for geolocation results to reduce API calls
const locationCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get location information from IP address with better error handling
 * @param {string} ip - IP address
 * @returns {Object} Location information
 */
const getLocationFromIP = async (ip) => {
  try {
    // For development/testing, if we get localhost or private IP, use a default location
    if (!ip || ip === 'localhost' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return {
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
        ip: ip || 'Unknown'
      };
    }

    // Check cache first
    const cacheKey = `ip_${ip}`;
    const cached = locationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Try multiple geolocation services with better error handling
    const services = [
      {
        name: 'ipapi.co',
        url: `https://ipapi.co/${ip}/json/`,
        transform: (data) => ({
          country: data.country_name || 'Unknown',
          region: data.region || 'Unknown',
          city: data.city || 'Unknown',
          timezone: data.timezone || 'UTC',
          ip: ip
        })
      },
      {
        name: 'ipinfo.io',
        url: `https://ipinfo.io/${ip}/json`,
        transform: (data) => ({
          country: data.country || 'Unknown',
          region: data.region || 'Unknown',
          city: data.city || 'Unknown',
          timezone: data.timezone || 'UTC',
          ip: ip
        })
      },
      {
        name: 'ip-api.com',
        url: `http://ip-api.com/json/${ip}`,
        transform: (data) => ({
          country: data.country || 'Unknown',
          region: data.regionName || 'Unknown',
          city: data.city || 'Unknown',
          timezone: data.timezone || 'UTC',
          ip: ip
        })
      }
    ];

    for (const service of services) {
      try {
        console.log(`Trying ${service.name} for IP: ${ip}`);
        const response = await axios.get(service.url, {
          timeout: 3000,
          headers: {
            'User-Agent': 'CartResQ/1.0'
          }
        });

        if (response.data && response.status === 200) {
          const locationData = service.transform(response.data);
          
          // Cache the result
          locationCache.set(cacheKey, {
            data: locationData,
            timestamp: Date.now()
          });

          console.log(`Successfully got location from ${service.name}:`, locationData);
          return locationData;
        }
      } catch (serviceError) {
        console.log(`Service ${service.name} failed for IP ${ip}:`, serviceError.message);
        continue;
      }
    }

    // If all services fail, return default location
    const defaultLocation = {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      timezone: 'UTC',
      ip: ip
    };

    // Cache the default result to avoid repeated API calls
    locationCache.set(cacheKey, {
      data: defaultLocation,
      timestamp: Date.now()
    });

    return defaultLocation;

  } catch (error) {
    console.error('Error getting location from IP:', error.message);
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      timezone: 'UTC',
      ip: ip || 'Unknown'
    };
  }
};

/**
 * Extract IP address from request object
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
const getClientIP = (req) => {
  // Check for forwarded headers (common in proxy setups)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Check for real IP header
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }

  // Check for CF-Connecting-IP (Cloudflare)
  const cfIP = req.headers['cf-connecting-ip'];
  if (cfIP) {
    return cfIP;
  }

  // Fallback to connection remote address
  return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || 'Unknown';
};

/**
 * Get location information for a request
 * @param {Object} req - Express request object
 * @returns {Object} Location information
 */
const getLocationFromRequest = async (req) => {
  const ip = getClientIP(req);
  
  // For development/testing, if we get localhost or private IP, use a default location
  if (ip === 'Unknown' || ip === 'localhost' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return {
      country: 'United States',
      region: 'California',
      city: 'San Francisco',
      timezone: 'America/Los_Angeles',
      ip: ip
    };
  }
  
  return await getLocationFromIP(ip);
};

module.exports = {
  getLocationFromIP,
  getClientIP,
  getLocationFromRequest
}; 