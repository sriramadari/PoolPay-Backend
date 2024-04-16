require('dotenv').config();  
const express = require('express')
const app = express();
const mongoose = require('mongoose');
const server = require('http').createServer(app)
const cors = require('cors');
const nodemailer = require('nodemailer');
const User = require('./Models/user');

const io = require('socket.io')(server,{
  cors:{
    origin:"*"
  }
})

app.use(express.json(),cors());
app.use(express.urlencoded({ extended: true }));
// Replace the following with your Atlas MongoDB URI 
const dbURI = "mongodb+srv://"+process.env.USER_NAME+":"+process.env.PASSWORD+"@cluster0.cncnbca.mongodb.net/CrewPeDB?retryWrites=true&w=majority";

mongoose.connect(dbURI)
  .then((result) => console.log('connected to MongoDB Atlas'))
  .catch((err) => console.log(err));



const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
      user: process.env.MAIL,
      pass: process.env.PASS
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const mobileNumberPools = {};
let totalUsers;
let acceptedPayments = 0;

io.on("connection", (socket) => {
  console.log("user connected with: ",socket.id);
  socket.on("joinPool", (mobileNumber) => {
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
    acceptedPayments=0;
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

app.post('/user', (req, res) => {
  const { email, phone } = req.body;
  console.log(email,phone)
  const user = new User({ email, phone });
  user.save()
    .then(() => res.status(201).json({ message: 'User created successfully' }))
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: err.message })
    });
});

app.get('/user/hasMobileNumber', async (req, res) => {
  const { email } = req.query;

  try {
    const user = await User.findOne({ email });
    console.log(user) 

    if (!user) {
      return res.json({ hasMobileNumber: false });
    }

    if (user.phone) {
      return res.json({ hasMobileNumber: user.phone });
    } else {
      return res.json({ hasMobileNumber: false });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/send-messages', async (req, res) => {
  const { numbers, messageTemplate } = req.body;
  console.log(numbers, messageTemplate)
  try {
    for (const recipient of numbers) {
      const { name, phoneNumber, amount } = recipient;
      const personalizedMessage = messageTemplate
        .replace('{name}', name)
        .replace('{amount}', amount);
        const user = await User.findOne({ phone: phoneNumber });

        if (!user || !user.email) {
          console.error(`No user found for phone number: ${phoneNumber}`);
          continue;
        }

      let info = await transporter.sendMail({
        from:process.env.MAIL,
        to: user.email,
        subject: "CrewPe services💖",
        text: personalizedMessage+" click this link to checkout https://pool-pay-frontend.vercel.app", 
      });

      console.log("Message sent: %s", info.messageId);
    }
    res.json({ success: true, message: 'Messages sent successfully' });
  } catch (error) {
    console.error('Error sending messages:', error);
    res.status(500).json({ success: false, message: 'Failed to send messages' });
  }
});

const port = 4000;
server.listen(port, () => {
    console.log(`Server is running on port ${port} 🚀`);
});
