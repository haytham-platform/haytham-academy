import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export interface ICourse extends Document {
  title: string;
  description: string;
  teacher: Types.ObjectId;
  department?: string;
  price: number;
  image: string;
  level: string;
  duration: string;
  startDate: Date;
  endDate?: Date;
  studyDays?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  color?: string;
  seats: number;
  remainingSeats: number;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    teacher: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    department: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: "" },
    level: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    studyDays: { type: String, trim: true },
    startTime: { type: String, trim: true },
    endTime: { type: String, trim: true },
    room: { type: String, trim: true },
    color: { type: String, default: "#6366f1", trim: true },
    seats: { type: Number, required: true, min: 1 },
    remainingSeats: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CourseSchema.pre("save", function () {
  if (this.isNew && (this.remainingSeats === undefined || this.remainingSeats === null)) {
    this.remainingSeats = this.seats;
  }
});

CourseSchema.index({ deletedAt: 1, isActive: 1, createdAt: -1 });

const Course: Model<ICourse> =
  mongoose.models.Course ?? mongoose.model<ICourse>("Course", CourseSchema);

export default Course;

export type CourseDocument = ICourse & { _id: Types.ObjectId };
