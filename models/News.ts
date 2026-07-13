import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface INews extends Document {
  title: string;
  excerpt: string;
  content: string;
  image: string;
  category: string;
  author: string;
  isPublished: boolean;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NewsSchema = new Schema<INews>(
  {
    title: { type: String, required: true, trim: true },
    excerpt: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    image: { type: String, default: "", trim: true },
    category: { type: String, default: "إعلانات", trim: true },
    author: { type: String, default: "إدارة الأكاديمية", trim: true },
    isPublished: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

NewsSchema.index({ isPublished: 1, publishedAt: -1 });
NewsSchema.index({ title: "text", excerpt: "text", content: "text" });

const News: Model<INews> =
  mongoose.models.News ?? mongoose.model<INews>("News", NewsSchema);

export default News;
