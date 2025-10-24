import { NextResponse,NextRequest } from "next/server";
import { cookies } from "next/headers"
import ConnectDb from "../../../../../middleware/connectdb";
import CheckAuth from "@/actions/CheckAuth";
import User from "../../../../../models/User";
import Vultr from "../../../../../models/Vultr";
export const GET = async()=>{
    try{
        const getcookie = await cookies();
        await ConnectDb();
        const auth = await CheckAuth();
        if(!auth.result){
            return NextResponse.json({error:"Unauthorized access not allowed",status:false});
        }
        //handling data and fetch user
        let finduser = await User.findOne({email:auth.email});
        if(!finduser){
            return NextResponse.json({error:"User not found",status:false});
        }
        //find on vultr
        let findvultr = await Vultr.findOne({userid:finduser._id});
        if(!findvultr){
            return NextResponse.json({error:"Vultr account not found",status:false});
        }
        const response = await getAccountInfo(findvultr.apikey);
        //update charge thena
        let updatecharge = await Vultr.updateOne({userid:finduser._id},{$set:{pending_charge:response.data.account.pending_charges}});
        return NextResponse.json({
            message:"Successfully fetched account details",
            status:true,
            data:response.data.account,
        });
    }
    catch(err){
        return NextResponse.json({error:"Something went wrong please try again after sometime"+err,status:false})
    }
}

export const POST = async(req:NextRequest)=>{
    try{
        const getcookie = await cookies();
        await ConnectDb();
        const auth = await CheckAuth();
        console.log("Auth",auth);
        //if not authenticate return
        if(!auth.result){
        return NextResponse.json({error:"Unauthorized access not allowed",status:false});
        }
        //handling data and fetch user
            
        const data = await req.json();
        // Validate API key
        if (!data.api_key) {
            return NextResponse.json({error:"API key is required",status:false});
        }   
        //validate user
        let finduser = await User.findOne({email:auth.email});
        if(!finduser){
            return NextResponse.json({error:"User not found",status:false});
        }

        const response = await getAccountInfo(data.api_key);
        console.log("Response",response.data.account);
        if(!response.success){
            return NextResponse.json({error:response.error,status:false});
        }
        let finddata = await Vultr.findOne({userid:finduser._id});
        if(!finddata){
           const newdata =new Vultr({
               userid:finduser._id,
               email:response.data.account.email,
               name:response.data.account.name,
               status:"active",
               pending_charge:response.data.account.pending_charges,
               apikey:data.api_key
           })
           await newdata.save();
        }
        return NextResponse.json({
            message:"Successfully created account",
            status:true,
            data,
            response
        });
    }
    catch(err){
        return NextResponse.json({error:"Something went wrong please try again after sometime"+err,status:false})
    }
}


//vultr functions

async function getAccountInfo(VULTR_API_KEY: string) {
  try {
    const response = await fetch(`${process.env.VULTR_BASE_URL}/account`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${VULTR_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
      return {error: `HTTP error! Status: ${response.status}`, success: false};
    }

    const data = await response.json();
    return {data,success:true}
  } catch (error) {
    console.error("Error fetching account:", error);
    return {error: "Error fetching account", success: false};
  }
}

