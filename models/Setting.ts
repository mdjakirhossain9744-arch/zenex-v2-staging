import mongoose, { Schema, models } from "mongoose";

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
  },
  { timestamps: true }
);

const Setting = models.Setting || mongoose.model("Setting", settingSchema);
export default Setting;