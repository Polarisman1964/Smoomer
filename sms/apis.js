const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');
const moment = require('moment-timezone');
require('dotenv').config();
const axios = require('axios'); // Add axios for HTTP requests
const ipapi = require('ipapi.co'); // Add ipapi.co module

// Set up Supabase client with your project URL and API key
const supabaseUrl = process.env.SUPABASE_URL; // Replace with your project URL
const supabaseKey = process.env.SUPABASE_KEY; // Replace with your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseKey);

// Twilio credentials (replace these with your actual values)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_NUMBER; // The number you received from Twilio

// Initialize Twilio client
const twilioClient = new twilio(accountSid, authToken);

// Helper function to capture customer city and country using ipapi.co
function captureCustomerLocation(ipAddress) {
  return new Promise((resolve, reject) => {
    axios.get(`https://ipapi.co/${ipAddress}/json/`)
      .then((response) => {
        const city = response.data.city || 'Unknown City';
        const country = response.data.country_name || 'Unknown Country';
        resolve({ city, country });
      })
      .catch((error) => {
        console.error('Error fetching location:', error);
        reject(new Error('Failed to fetch location'));
      });
  });
}

// API to send the discount code via SMS
async function sendDiscount(req, res) {
  const { phone } = req.body; // The phone number submitted by the customer
  console.log(req.params); // Log the request body to debug
  try {
    // Send SMS using Twilio
    await twilioClient.messages.create({
      body: "Here's your 10% off coupon: VIP10. Use it at checkout!",
      from: twilioNumber, // Your Twilio phone number
      to: phone, // Customer's phone number
    });

    res.status(200).send({ success: true, message: "Discount sent successfully!" });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
}

// API to handle consent info and save it to Supabase
async function saveConsent(req, res) {
  const { customer_id, first_name, phone_number, opt_in_status, ip_address } = req.body;

  try {
    // Check if the phone number already exists in the database
    const { data: existingData, error: fetchError } = await supabase
      .from('tcpa')
      .select('phone_number')
      .eq('phone_number', phone_number)
      .limit(1);

    if (fetchError) {
      console.error('Error checking existing phone number:', fetchError);
      throw new Error('Failed to check existing phone number');
    }

    if (existingData && existingData.length > 0) {
      return res.status(400).send({ success: false, message: 'Phone number already consented' });
    }

    // Capture customer location using IP address from req.body
    const { city, country } = await captureCustomerLocation(ip_address);

    // Log the received data to debug
    console.log('Consent received:', {
      customer_id,
      first_name,
      phone_number,
      opt_in_status,
      ip_address,
      city,
      country,
    });

    // Save customer consent information in Supabase
    await saveCustomerConsent(customer_id, first_name, phone_number, opt_in_status, ip_address, city, country);

    // Respond to client with success message
    res.status(200).send({ success: true, message: 'Consent information saved successfully!' });
  } catch (error) {
    console.error("Error saving consent:", error);
    res.status(500).send({ success: false, message: 'Failed to save consent information' });
  }
}

// API to retrieve consent info from Supabase
async function getConsent(req, res) {
  const { customer_id } = req.body;

  try {
    // Retrieve customer consent information from Supabase
    const { data, error } = await supabase
      .from('tcpa')
      .select('*')
      .eq('customer_id', customer_id)
      .limit(1); // Select only one row

    if (error) {
      console.error('Error fetching data: ', error);
      throw new Error('Failed to fetch consent');
    }

    console.log('Data fetched: ', data);
    res.status(200).send({ success: true, data });
  } catch (error) {
    console.error("Error fetching consent:", error);
    res.status(500).send({ success: false, message: 'Failed to fetch consent information' });
  }
}

// API to update consent info in Supabase
async function updateConsent(req, res) {
  const { customer_id } = req.body;

  try {
    // Retrieve current consent information
    const { data, error } = await supabase
      .from('tcpa')
      .select('opt_in_status')
      .eq('customer_id', customer_id)
      .single();

    if (error) {
      console.error('Error fetching data: ', error);
      throw new Error('Failed to fetch consent');
    }

    // Toggle the opt_in_status
    const newOptInStatus = data.opt_in_status === true ? 'no' : 'yes';

    // Update the consent information
    const { updateError } = await supabase
      .from('tcpa')
      .update({ opt_in_status: newOptInStatus })
      .eq('customer_id', customer_id);

    if (updateError) {
      console.error('Error updating data: ', updateError);
      throw new Error('Failed to update consent');
    }

    console.log('Consent updated: ', newOptInStatus);
    res.status(200).send({ success: true, message: 'Consent information updated successfully!' });
  } catch (error) {
    console.error("Error updating consent:", error);
    res.status(500).send({ success: false, message: 'Failed to update consent information' });
  }
}

// Function to save consent info to Supabase
async function saveCustomerConsent(customerId, firstName, phoneNumber, optInStatus, ipAddress, city, country) {
  const timestamp = moment().tz("America/New_York").format(); // Generate timestamp in EST
  const { data, error } = await supabase
    .from('tcpa')
    .insert([
      {
        customer_id: customerId,
        first_name: firstName,
        phone_number: phoneNumber,
        opt_in_status: optInStatus,
        timestamp: timestamp, // Use the EST timestamp
        ip_address: ipAddress,
        city: city,
        country: country,
      },
    ]);

  if (error) {
    console.error('Error inserting data: ', error);
    throw new Error('Failed to save consent');
  }

  console.log('Data inserted: ', data);
}

module.exports = { sendDiscount, saveConsent, getConsent, updateConsent };
