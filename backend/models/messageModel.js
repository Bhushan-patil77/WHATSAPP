import mongoose from "mongoose";


const messageSchema = new mongoose.Schema(
    {
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      text: {
        type: String,
      },
      images: {
        type: Array,
        default:[]
      },
      delivered:{
        type:Boolean,
        default:false
      },
      seen:{
        type:Boolean,
        default:false
      },
      messageId:{
        type:String,
        default:''
      }
    },
    { timestamps: true }
  );
  
  const Message = mongoose.model("Message", messageSchema);
  
  export default Message;