import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IAcademyService {
  title: string;
  description: string;
  icon: string;
}

export interface IAcademyStat {
  label: string;
  value: string;
  icon: string;
}

export interface IAcademyTestimonial {
  name: string;
  role: string;
  content: string;
  rating: number;
  avatar?: string;
}

export interface IAcademySettings extends Document {
  singletonKey: "academy";
  name: string;
  nameEn: string;
  description: string;
  phone: string;
  address: string;
  services: IAcademyService[];
  stats: IAcademyStat[];
  testimonials: IAcademyTestimonial[];
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IAcademyService>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    icon: { type: String, default: "book-open", trim: true },
  },
  { _id: false }
);

const StatSchema = new Schema<IAcademyStat>(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    icon: { type: String, default: "trophy", trim: true },
  },
  { _id: false }
);

const TestimonialSchema = new Schema<IAcademyTestimonial>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    avatar: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const AcademySettingsSchema = new Schema<IAcademySettings>(
  {
    singletonKey: {
      type: String,
      default: "academy",
      immutable: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    nameEn: { type: String, default: "Haytham Academy", trim: true },
    description: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    services: { type: [ServiceSchema], default: [] },
    stats: { type: [StatSchema], default: [] },
    testimonials: { type: [TestimonialSchema], default: [] },
  },
  { timestamps: true }
);

const AcademySettings: Model<IAcademySettings> =
  mongoose.models.AcademySettings ??
  mongoose.model<IAcademySettings>("AcademySettings", AcademySettingsSchema);

export default AcademySettings;
