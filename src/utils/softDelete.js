const mongoose = require("mongoose");
const logger = require("./logger");

const applySoftDelete = (schema) => {
  schema.add({
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  });

  const softDeleteFilter = function (next) {
    this.where({ isDeleted: false });
    next();
  };

  schema.pre("find", softDeleteFilter);
  schema.pre("findOne", softDeleteFilter);
  schema.pre("findOneAndUpdate", softDeleteFilter);
  schema.pre("updateMany", softDeleteFilter);

  schema.methods.softDelete = async function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    await this.save();
    logger.info(`Soft deleted document: ${this._id} in collection ${this.constructor.modelName}`);
  };
};

const softDeleteRelated = async (modelName, query) => {
  const Model = mongoose.model(modelName);
  const docs = await Model.find(query);
  for (const doc of docs) {
    if (!doc.isDeleted) {
      await doc.softDelete();
    }
  }
};

module.exports = { applySoftDelete, softDeleteRelated };