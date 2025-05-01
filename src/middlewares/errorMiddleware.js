const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }

  if (err.name === "MongoError" && err.code === 11000) {
    return res.status(400).json({ message: "Duplicate key error" });
  }

  res.status(err.status || 500).json({ 
    message: err.message || "Something went wrong!",
    error: err.message 
  });
};

module.exports = errorHandler;