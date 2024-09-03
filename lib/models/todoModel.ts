import mongoose, { Document, Model } from "mongoose";

export interface ITodo {
  todo: string;
  todoDeadline: Date;
}

export interface ITodoDocument extends ITodo, Document {
  createdAt: Date;
  updatedAt: Date;
}

const todoSchema = new mongoose.Schema<ITodoDocument>(
  {
    todo: {
      type: String,
      required: true,
    },
    todoDeadline: {
      type: Date,
      required: true,
      validate: {
        validator: function (v: any) {
          return v instanceof Date && !isNaN(v.getTime());
        },
        message: (props) => `${props.value} is not a valid date!`,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Todo: Model<ITodoDocument> =
  mongoose.models?.Todo || mongoose.model("Todo", todoSchema);

export default Todo;
