const express = require('express')
const app = express();
const server = require('http').createServer(app)
const cors = require('cors');
const io = require('socket.io')(server,{
  cors:{
    origin:"*"
  }
})
const bodyParser = require('body-parser');
app.use(express.json(),cors());
// const poolSocket=io.of("/pool");

// const accountSid = 'ACf680c4080efebab4cea8b60cbb5620d4'; // Your Twilio Account SID
// const authToken = '6eb830f7275aa64d35a56500c572e9f2';     // Your Twilio Auth Token
// // const client = require('twilio')(accountSid, authToken);

const accountSid = 'AC6588fe8f78edd2b554062bf026a42889';
const authToken = 'c7eb2706448473be0e16ab42627a30a6';
const client = require('twilio')(accountSid, authToken);

app.use(bodyParser.json());

const mobileNumberPools = {};
let totalUsers;
let acceptedPayments = 0;

io.on("connection", (socket) => {
  console.log("user connected with: ",socket.id);
  
  socket.on("joinPool", (mobileNumber) => {
    // Join the POOL with mobile number
    const existingPool = socket.rooms[mobileNumber];
// console.log(existingPool)
  if (existingPool) {
    // Leave the existing pool
    socket.leave(existingPool);
    console.log(`User left Pool: ${existingPool}`);
  }

  // Join the POOL with mobile number
  socket.join(mobileNumber);
  console.log(`User joined Pool: ${mobileNumber}`);

  // Update the mobile number Pool with the socket ID
  mobileNumberPools[mobileNumber] = socket.id;
  console.log(mobileNumberPools);
  });


  socket.on("paymentConfirmation", (users) => {
    // Iterate through the user details and emit payment confirmation to each user
    console.log(mobileNumberPools)
    console.log(users.length)
    
    totalUsers = users.length;    
    // console.log(totalUsers)
    users.forEach((user) => {
        const mobileNumber = user.phoneNumber;
        const socketId = mobileNumberPools[mobileNumber]; // Get the socket ID for the user
      console.log(socketId)
        if (socketId) {
          // Emit the "Payment Confirmation" message to the user's socket
          socket.to(socketId).emit("paymentStatus", {
            status: "Payment Confirmation", 
            Amount:user.amount
          });
          console.log(`Confirmation message sent to user: ${socketId}`, mobileNumber);
        } else {
          console.log("No socket found for mobileNumber: ", mobileNumber);
        }
      });     
     
      
  });

  socket.on("paymentAccepted", () => {
    acceptedPayments++;
    console.log(acceptedPayments)
    console.log(totalUsers)
    if (acceptedPayments === totalUsers) {
    console.log("All payments accepted")
      io.emit("Accepted", { status: "All payments accepted" });
      acceptedPayments=0;
    }
  });
  
  socket.on("paymentDeclined", () => {
    io.emit("Declined",{status:"someone declined the payment"})
  });
  

  socket.on("disconnect", () => {
    console.log("A user disconnected");

    // Find the Pools the socket is currently in
    const Pools = Object.keys(socket.rooms);

    // Loop through the Pools (excluding the socket ID)
    Pools.forEach((Pool) => {
      if (Pool !== socket.id) {
        // Leave the Pool
        console.log(`User left Pool: ${Pool}`);
        socket.leave(Pool);

        // Remove the socket ID from the mobile number Pool
        const mobileNumber = Pool;
        if (mobileNumberPools[mobileNumber]) {
          mobileNumberPools[mobileNumber] = mobileNumberPools[mobileNumber].filter(
            (id) => id !== socket.id
          );

          // Remove the mobile number Pool entry if there are no sockets in it
          if (mobileNumberPools[mobileNumber].length === 0) {
            delete mobileNumberPools[mobileNumber];
          }
        }
      }
    });
  });
});



// POST endpoint to send messages to multiple mobile numbers
app.post('/send-messages', async (req, res) => {
    const { numbers, message } = req.body;
    console.log(req.body)
    try {
        // Loop through each mobile number and send a message
        for (const number of numbers) {
            await client.messages
                .create({
                    body: message,
                    from: 'whatsapp:+14155238886',
                    to: `whatsapp:+91${number}`
                })
                .then(message => console.log(message.sid))

        }

        res.json({ success: true, message: 'Messages sent successfully' });
    } catch (error) {
        console.error('Error sending messages:', error);
        res.status(500).json({ success: false, message: 'Failed to send messages' });
    }
});

const port = 4000;
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
