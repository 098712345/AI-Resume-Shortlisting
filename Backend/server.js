
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/resumes", (req, res) => {
  res.json({
    message: "Resume API is working!"
  });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
