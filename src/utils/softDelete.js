const mongoose = require("mongoose");

// Apply soft delete middleware to a schema
const applySoftDelete = (schema) => {
  // Add soft delete fields to the schema
  schema.add({
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  });

  // Middleware to filter out soft-deleted documents
  schema.pre("find", function (next) {
    this.where({ isDeleted: false });
    next();
  });

  schema.pre("findOne", function (next) {
    this.where({ isDeleted: false });
    next();
  });

  // Method to soft delete a document
  schema.methods.softDelete = async function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    await this.save();
  };
};

// Helper to soft delete related documents
const softDeleteRelated = async (modelName, query) => {
  const Model = mongoose.model(modelName);
  const doc = await Model.findOne(query);
  if (doc && !doc.isDeleted) {
    await doc.softDelete();
  }
};

module.exports = { applySoftDelete, softDeleteRelated };