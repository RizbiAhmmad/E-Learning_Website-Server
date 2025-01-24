const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
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
    const classCollection = client.db("ElearningDB").collection("classes");

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      // console.log("Generated Token:", token);
      res.send({ token });
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

      // use verify admin after verifyToken
      const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        if (!isAdmin) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }

     // user related api
    app.get('/users',verifyToken, async (req, res) => {
      // console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const { email, photoURL } = user;
    
      // Ensure the role defaults to 'user' if not provided
      user.role = user.role || 'user';
    
      const query = { email: email };
    
      // Check if the user already exists
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
    
      // Insert the new user
      const result = await userCollection.insertOne(user);
      res.status(201).send(result);
    });
    

      // Making user in Admin
      app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: 'admin'
          }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      })
      // Making user in Teacher
      app.patch('/users/teacher/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: 'teacher'
          }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      })

      // Get user role

      app.get('/users/role', async (req, res) => {
        const email = req.query.email; // Assuming email is sent as a query parameter
        const user = await userCollection.findOne({ email });
        console.log(user);
        res.send({ role: user?.role || "user" });
        
    });

      // Delete user
      app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await userCollection.deleteOne(query);
        res.send(result);
      })
  




      // Teach Application API
      app.get("/teach-applications", async (req, res) => {
        try {
          const applications = await teachApplicationsCollection.find().toArray();
          res.status(200).send(applications);
        } catch (error) {
          console.error("Error fetching applications:", error);
          res.status(500).send({ message: "Failed to fetch applications." });
        }
      });      

      app.post("/teach-application", async (req, res) => {
        const application = req.body;
        // console.log("Received data:", req.body);
        try {
          const result = await teachApplicationsCollection.insertOne(application);
          res.status(201).send(result); 
        } catch (error) {
          console.error("Error inserting application:", error);
          res.status(500).send({ message: "Failed to submit application." });
        }
      });

      // Teacher application approve or reject
      app.patch("/teach-applications/approve/:id", async (req, res) => {
        const id = req.params.id;
      
        try {
          // Find the application to get the user's email
          const application = await teachApplicationsCollection.findOne({ _id: new ObjectId(id) });
      
          if (!application) {
            return res.status(404).send({ message: "Application not found." });
          }
      
          const email = application.email; 
      
          
          const updateApplicationResult = await teachApplicationsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "Accepted", role: "teacher" } } 
          );
      
          // Update the user's role in the users collection to "teacher"
          const updateUserResult = await userCollection.updateOne(
            { email }, 
            { $set: { role: "teacher" } }
          );
      
          res.send({
            applicationUpdate: updateApplicationResult,
            userUpdate: updateUserResult,
            message: "Application approved, and role updated to teacher in both databases.",
          });
        } catch (error) {
          console.error("Error approving application:", error);
          res.status(500).send({ message: "Failed to approve application." });
        }
      });
      
      

      app.patch("/teach-applications/reject/:id", async (req, res) => {
        const id = req.params.id;
        try {
          const result = await teachApplicationsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "Rejected" } }
          );
          res.send(result);
        } catch (error) {
          console.error("Error rejecting application:", error);
          res.status(500).send({ message: "Failed to reject application." });
        }
      });



    // All Classes API
    app.get("/classes", async (req, res) => {
      try {
        const { status, teacherEmail } = req.query;
        const query = {
          ...(status && { status }),
          ...(teacherEmail && { email: teacherEmail }),
        };
        const classes = await classCollection.find(query).toArray();
    
        res.status(200).send(classes);
      } catch (error) {
        console.error("Error fetching classes:", error);
        res.status(500).send({ message: "Failed to fetch classes." });
      }
    });
    


app.post('/classes', async (req, res) => {
  const newClass = req.body;

  try {
    const result = await classCollection.insertOne(newClass);
    res.status(201).send({
      message: "Class added successfully!",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Error adding class:", error);
    res.status(500).send({ message: "Failed to add class." });
  }
});

    // Update Class Status API
app.patch("/classes/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await classCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    if (result.modifiedCount > 0) {
      res.status(200).send({ message: "Class status updated successfully!" });
    } else {
      res.status(404).send({ message: "Class not found or already updated." });
    }
  } catch (error) {
    console.error("Error updating class status:", error);
    res.status(500).send({ message: "Failed to update class status." });
  }
});



app.put("/classes/:id", async (req, res) => {
  const { id } = req.params;
  const updatedClass = req.body;

  try {
    const result = await classCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedClass }
    );

    if (result.modifiedCount > 0) {
      res.status(200).send({ message: "Class updated successfully!" });
    } else {
      res.status(404).send({ message: "Class not found or already updated." });
    }
  } catch (error) {
    console.error("Error updating class:", error);
    res.status(500).send({ message: "Failed to update class." });
  }
});


app.delete("/classes/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await classCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount > 0) {
      res.status(200).send({ message: "Class deleted successfully!" });
    } else {
      res.status(404).send({ message: "Class not found." });
    }
  } catch (error) {
    console.error("Error deleting class:", error);
    res.status(500).send({ message: "Failed to delete class." });
  }
});

app.get("/classes/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const classDetails = await classCollection.findOne({ _id: new ObjectId(id) });

    if (classDetails) {
      res.status(200).send(classDetails);
    } else {
      res.status(404).send({ message: "Class not found." });
    }
  } catch (error) {
    console.error("Error fetching class details:", error);
    res.status(500).send({ message: "Failed to fetch class details." });
  }
});


app.put("/class/:id", async (req, res) => {
  const { id } = req.params;
  const updatedClass = req.body;

  
  const { _id, ...updateFields } = updatedClass;

  try {
    const result = await classCollection.updateOne(
      { _id: new ObjectId(id) }, 
      { $set: updateFields }     
    );
    res.send(result);
  } catch (error) {
    console.error("Error updating class:", error);
    res.status(500).send({ error: "Failed to update class" });
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