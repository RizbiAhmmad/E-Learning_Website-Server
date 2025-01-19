const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000

// Middleware to parse JSON request bodies
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jwqfj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const userCollection = client.db("ElearningDB").collection("users");
    const teachApplicationsCollection = client.db("ElearningDB").collection("teachApplications");


     // user related api
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

     app.post ('/users', async (req, res) => {
        const user = req.body;
        // insert email if user doesnot exist
        const query = {email: user.email}
        const existingUser = await userCollection.findOne(query);
        if (existingUser){
          return res.send({message:'User already exists', insertedId:null});
        }
        const result = await userCollection.insertOne(user);
        res.status(201).send(result);
      })

      // Delete user
      app.delete('/users/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await userCollection.deleteOne(query);
        res.send(result);
      })
  




      // Teach Application API
      app.post("/teach-application", async (req, res) => {
        const application = req.body;
        // console.log("Received data:", req.body);
        try {
          const result = await teachApplicationsCollection.insertOne(application);
          res.status(201).send(result); // Respond with the inserted document's ID
        } catch (error) {
          console.error("Error inserting application:", error);
          res.status(500).send({ message: "Failed to submit application." });
        }
      });
      








    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get ('/', (req, res) => {
    res.send('Welcome to E-Learning Server');
})

app.listen (port, ()=>{
    console.log(`Server running on port ${port}`);
})