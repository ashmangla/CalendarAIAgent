// Test script to verify microservices architecture
const axios = require('axios');

async function testServices() {
  console.log('🔧 Testing Microservices Architecture...\n');

  try {
    // Test 1: Main Server Health
    console.log('1️⃣ Testing Main Server Health...');
    const mainHealth = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Main Server:', mainHealth.data.message);

    // Test 2: Uber Service Health (Direct)
    console.log('\n2️⃣ Testing Uber Service Health (Direct)...');
    const uberHealthDirect = await axios.get('http://localhost:5001/api/health');
    console.log('✅ Uber Service (Direct):', uberHealthDirect.data.status);

    // Test 3: Uber Service Health (Through Main Server)
    console.log('\n3️⃣ Testing Uber Service Health (Through Main Server)...');
    const uberHealthProxy = await axios.get('http://localhost:5000/api/uber/health');
    console.log('✅ Uber Service (Proxy):', uberHealthProxy.data.data.status);

    // Test 4: Fare Estimate
    console.log('\n4️⃣ Testing Fare Estimate API...');
    const fareEstimate = await axios.post('http://localhost:5000/api/uber/estimate', {
      pickup: 'Central Park, NY',
      dropoff: 'Times Square, NY'
    });
    console.log('✅ Fare Estimate Success:');
    console.log('   Distance:', fareEstimate.data.data.distance);
    console.log('   Duration:', fareEstimate.data.data.duration);
    console.log('   Available Rides:', fareEstimate.data.data.estimates.length);

    // Test 5: Ride Request
    console.log('\n5️⃣ Testing Ride Request API...');
    const rideRequest = await axios.post('http://localhost:5000/api/uber/request', {
      pickup: 'Central Park, NY',
      dropoff: 'Times Square, NY',
      rideType: 'standard'
    });
    console.log('✅ Ride Request Success:');
    console.log('   Ride ID:', rideRequest.data.data.rideId);
    console.log('   Status:', rideRequest.data.data.status);
    console.log('   Driver:', rideRequest.data.data.driver.name);
    console.log('   ETA:', rideRequest.data.data.eta, 'minutes');

    // Test 6: Ride Status
    const rideId = rideRequest.data.data.rideId;
    console.log('\n6️⃣ Testing Ride Status API...');
    const rideStatus = await axios.get(`http://localhost:5000/api/uber/rides/${rideId}`);
    console.log('✅ Ride Status:', rideStatus.data.data.status);

    // Test 7: Cancel Ride
    console.log('\n7️⃣ Testing Ride Cancellation...');
    const cancelResult = await axios.delete(`http://localhost:5000/api/uber/rides/${rideId}`);
    console.log('✅ Ride Cancelled:', cancelResult.data.data.message);

    console.log('\n🎉 All tests passed! Microservices architecture is working correctly.');
    console.log('\n📊 Architecture Summary:');
    console.log('   🏠 Main Server: Port 5000 (Calendar + Proxy)');
    console.log('   🚕 Uber Service: Port 5001 (Independent Microservice)');
    console.log('   🔄 Communication: HTTP REST APIs');
    console.log('   📱 Client: React app with navigation');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testServices();