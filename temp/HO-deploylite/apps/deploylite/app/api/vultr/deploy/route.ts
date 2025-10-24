// app/api/deploy/route.ts (App Router TypeScript)

import { NextRequest, NextResponse } from 'next/server';
import CheckAuth from '@/actions/CheckAuth';
import User from '../../../../../models/User';
import Vultr from '../../../../../models/Vultr';
var API_KEY = "";

interface RequestBody {
  containerName: string;
  tags?: string[];
}

interface VultrOS {
  id: number;
  name: string;
}

interface VultrOSResponse {
  os: VultrOS[];
}

interface VultrInstance {
  id: string;
  main_ip: string;
  status: string;
}

interface VultrInstanceResponse {
  instance: VultrInstance;
}

interface SuccessResponse {
  success: true;
  message: string;
  instance: {
    id: string;
    ip: string;
    status: string;
    accessUrl: string;
    containerName: string;
    tags: string[];
    label: string;
    hostname: string;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  message: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    // Parse request body
    
    const body: RequestBody = await request.json();
    const { containerName, tags } = body;
    const responsed = await CheckAuth();
    if(!responsed.result){
      return NextResponse.json({success:false,error:"User not validated",message:"Noo Baxkend"})
    }

    const finddata = await User.findOne({email:responsed.email});
    if(!finddata){
      return NextResponse.json({success:false,error:"user not found",message:"Noo Baxkend"})
    }
    let vultrdata = await Vultr.findOne({userid:finddata._id});
    if(!vultrdata){
      return NextResponse.json({success:false,error:"Vultr data not found",message:"Noo Baxkend"})
    }
    API_KEY=vultrdata.apikey;

    
    // Validate required inputs
    if (!containerName) {
      return NextResponse.json(
        { 
          success: false,
          error: "Validation error",
          message: "Container name is required" 
        },
        { status: 400 }
      );
    }

    // Validate API key
    if (!API_KEY) {
      return NextResponse.json(
        { 
          success: false,
          error: "Configuration error",
          message: "VULTR_API_KEY environment variable not set" 
        },
        { status: 500 }
      );
    }

    // Get correct OS ID first
    const osResponse = await fetch("https://api.vultr.com/v2/os", {
      headers: { 
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
    });
    
    if (!osResponse.ok) {
      throw new Error(`Failed to fetch OS list: ${osResponse.status}`);
    }
    
    const osData: VultrOSResponse = await osResponse.json();
    const ubuntu = osData.os.find((os: VultrOS) => 
      os.name.includes('Ubuntu') && os.name.includes('22.04') && os.name.includes('x64')
    );
    
    let osId: number;
    if (!ubuntu) {
      // Fallback to any Ubuntu
      const anyUbuntu = osData.os.find((os: VultrOS) => os.name.includes('Ubuntu'));
      if (!anyUbuntu) {
        throw new Error("No Ubuntu OS found");
      }
      console.log(`Using fallback Ubuntu: ${anyUbuntu.name} (ID: ${anyUbuntu.id})`);
      osId = anyUbuntu.id;
    } else {
      osId = ubuntu.id;
    }

    // Hardcoded values (previously dynamic inputs)
    const giturl: string = "https://github.com/BasirKhan418/CourseConnect.git";
    const projectid: string = "test123";
    const techused: string = "mern";
    const installcommand: string = "npm install";
    const buildcommand: string = "npm run build";
    const runcommand: string = "npm start";
    const env: string = "NODE_ENV=production";

    const startupScript: string = `#!/bin/bash
apt-get update -y
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker
usermod -aG docker ubuntu

docker run -d \\
  -p 80:80 \\
  --name ${containerName} \\
  -e GIT_URL="${giturl}" \\
  -e PROJECT_ID="${projectid}" \\
  -e TECH_USED="${techused}" \\
  -e INSTALL_COMMAND="${installcommand}" \\
  -e BUILD_COMMAND="${buildcommand}" \\
  -e RUN_COMMAND="${runcommand}" \\
  -e ENVIRONMENT="${env}" \\
  basir418/fullstack-builder-image:latest
`;

    // Convert to base64 for user data
    const userData: string = Buffer.from(startupScript).toString('base64');

    // Prepare tags array
    const instanceTags: string[] = tags && Array.isArray(tags) ? [containerName, ...tags] : [containerName];

    const createInstancePayload = {
      region: "ewr",
      plan: "vc2-1c-1gb", 
      os_id: osId,
      label: `deploy-${containerName}`,
      hostname: `deploy-${containerName}`,
      user_data: userData,
      tags: instanceTags
    };

    const response = await fetch("https://api.vultr.com/v2/instances", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createInstancePayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Vultr API Error:", errorText);
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data: VultrInstanceResponse = await response.json();
    
    console.log("Instance created successfully:", {
      id: data.instance.id,
      ip: data.instance.main_ip,
      status: data.instance.status
    });

    return NextResponse.json({
      success: true,
      message: "Instance created successfully",
      instance: {
        id: data.instance.id,
        ip: data.instance.main_ip,
        status: data.instance.status,
        accessUrl: `http://${data.instance.main_ip}`,
        containerName,
        tags: instanceTags,
        label: `deploy-${containerName}`,
        hostname: `deploy-${containerName}`
      }
    }, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("Deployment error:", errorMessage);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to create instance", 
        message: errorMessage 
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET(): Promise<NextResponse<ErrorResponse>> {
  return NextResponse.json(
    { 
      success: false,
      error: "Method not allowed", 
      message: "Use POST method instead." 
    },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse<ErrorResponse>> {
  return NextResponse.json(
    { 
      success: false,
      error: "Method not allowed", 
      message: "Use POST method instead." 
    },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse<ErrorResponse>> {
  return NextResponse.json(
    { 
      success: false,
      error: "Method not allowed", 
      message: "Use POST method instead." 
    },
    { status: 405 }
  );
}