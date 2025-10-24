
import mongoose from "mongoose";
import { Schema } from "mongoose";

const VultrSchema = Schema({
userid:{ type: Schema.Types.ObjectId,ref:'User', required: true},
email:{type:String,required:true},
name:{type:String,required:true},
status:{type:String,default:"active"},
pending_charge:{type:Number,default:0},
apikey:{type:String,required:true}

},{timestamps:true})

mongoose.models = {}
export default mongoose.model.Vultr||mongoose.model('Vultr',VultrSchema);