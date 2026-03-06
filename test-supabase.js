const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ymlgpgkshzjvqjemneyr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltbGdwZ2tzaHpqdnFqZW1uZXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjIyOTYsImV4cCI6MjA4NzA5ODI5Nn0.mtFPOAenVnp3wgeJVEXKp8TWFnXI1_b8Ac4TupbDnlg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from("devices")
    .select(`
      id, name, status, location,
      device_metrics (
        body_length,
        weight,
        created_at
      )
    `);
    
  console.log("Error object:", error);
  if (error) {
    console.log("Stringified error:", JSON.stringify(error));
    console.log("Error keys:", Object.keys(error));
    console.log("Error message:", error.message);
    console.log("Error details:", error.details);
    console.log("Error hint:", error.hint);
    console.log("Error code:", error.code);
  }
}

test();
