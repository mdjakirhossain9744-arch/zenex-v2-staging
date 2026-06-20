import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../../../models/User"; 
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    const token = req.cookies.get("zenex_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "🔴 UNAUTHORIZED: No token found!" }, { status: 401 });
    }

    let realRequesterRole = "user";
    let realRequesterEmail = "";

    try {
      const payloadBase64 = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadBase64));
      realRequesterRole = decodedPayload.role;
      realRequesterEmail = decodedPayload.email;
    } catch (err) {
      return NextResponse.json({ message: "🔴 FORBIDDEN: Invalid Token!" }, { status: 403 });
    }

    if (realRequesterRole === "user") {
      return NextResponse.json({ message: "🔴 ACCESS DENIED: Users cannot update accounts!" }, { status: 403 });
    }

    const body = await req.json();
    const { 
      userId, newPassword, newPin, newRate, newStatus, newRole, 
      customMail, contactLink, maxLimit, isApiActive,
      newAgentEmail, 
      handoverToEmail,
      generateNewKey,
      newBalance,
      canManageApi // 💥 NEW: Admin to Agent API Permission
    } = body;

    // 💥 MASTER FIX: Block Undefined CastErrors 💥
    if (!userId) {
       return NextResponse.json({ message: "🔴 ERROR: Valid User ID is required!" }, { status: 400 });
    }

    // 💥 ULTRA-HYBRID ID RESOLVER 💥
    const isValidMongoId = mongoose.Types.ObjectId.isValid(userId);
    
    const targetUser = await User.findOne({
      $or: [
        ...(isValidMongoId ? [{ _id: userId }] : []),
        { zxId: userId },     
        { email: userId }     
      ]
    });

    if (!targetUser) {
      return NextResponse.json({ message: "User not found in database!" }, { status: 404 });
    }

    const realDbId = targetUser._id; 
    const isTargetAgent = newRole === "agent" || targetUser.role === "agent";
    let updateData: any = {};

    // 💥 BALANCE UPDATE FIX 💥
    if (newBalance !== undefined && newBalance !== null && newBalance !== "") {
       if (realRequesterRole !== "admin") {
          return NextResponse.json({ message: "🔴 SECURITY: Only Admins can edit balance directly!" }, { status: 403 });
       }
       updateData.balance = parseFloat(newBalance);
    }

    // 💥 GENERATE NEW API KEY (Admin + Authorized Agent) 💥
    if (generateNewKey) {
      let isAllowedToGenerate = false;

      if (realRequesterRole === "admin") {
         isAllowedToGenerate = true;
      } else if (realRequesterRole === "agent") {
         const agentDoc = await User.findOne({ email: realRequesterEmail });
         // Check if agent has permission AND user belongs to this agent
         if (
           agentDoc?.canManageApi && 
           (targetUser.agentEmail === agentDoc.email || targetUser.agentEmail === agentDoc.customAgentMail)
         ) {
            isAllowedToGenerate = true;
         }
      }

      if (!isAllowedToGenerate) {
         return NextResponse.json({ message: "🔴 SECURITY: You do not have Admin permission to generate API keys!" }, { status: 403 });
      }

      const newApiKey = "ZNX_" + crypto.randomBytes(16).toString("hex").toUpperCase();
      updateData.apiKey = newApiKey;
    }

    // 💥 AGENT OWNERSHIP HANDOVER 💥
    if (handoverToEmail && targetUser.role === "agent" && newRole === "user") {
      if (realRequesterRole !== "admin") {
         return NextResponse.json({ message: "🔴 SECURITY: Only Admins can handover agent networks!" }, { status: 403 });
      }

      const newOwner = await User.findOne({ email: handoverToEmail });
      if (!newOwner) {
         return NextResponse.json({ message: "🔴 Handover Failed: Target new owner email not found!" }, { status: 404 });
      }
      if (newOwner.role === "admin") {
         return NextResponse.json({ message: "🔴 Handover Failed: Cannot handover network to an Admin!" }, { status: 400 });
      }

      await User.updateMany(
         { agentEmail: targetUser.email, role: "user" },
         { $set: { agentEmail: newOwner.email } }
      );

      await User.findByIdAndUpdate(newOwner._id, {
         $set: {
            role: "agent",
            agentMaxRate: targetUser.agentMaxRate || 0,
            agentMaxUsers: targetUser.agentMaxUsers || 100,
            customAgentMail: targetUser.customAgentMail || "",
            telegramLink: targetUser.telegramLink || "",
            canManageApi: targetUser.canManageApi || false // Transfer API perm too
         }
      });

      updateData.agentMaxRate = 0;
      updateData.agentMaxUsers = 100;
      updateData.customAgentMail = "";
      updateData.telegramLink = "";
      updateData.canManageApi = false;
    }

    // 💥 USER NETWORK TRANSFER LOGIC 💥
    if (newAgentEmail && newAgentEmail !== targetUser.agentEmail && targetUser.role === "user") {
      if (realRequesterRole !== "admin") {
        return NextResponse.json({ message: "🔴 SECURITY: Only Admins can transfer user networks!" }, { status: 403 });
      }
      
      const newAgent = await User.findOne({ 
         $or: [
            { email: newAgentEmail }, 
            { customAgentMail: newAgentEmail }
         ] 
      });

      if (!newAgent || (newAgent.role !== "agent" && newAgent.role !== "admin")) {
        return NextResponse.json({ message: "🔴 TRANSFER FAILED: Target Agent not found or invalid!" }, { status: 404 });
      }

      if (newAgent.role === "agent") {
        const currentUsersCount = await User.countDocuments({ 
            role: "user",
            $or: [
                { agentEmail: newAgent.email },
                { agentEmail: newAgent.customAgentMail }
            ]
        });
        const agentSeatLimit = newAgent.agentMaxUsers || 100;
        
        if (currentUsersCount >= agentSeatLimit) {
          return NextResponse.json({ message: `🔴 TRANSFER FAILED: Target Agent's network is full (Limit: ${agentSeatLimit})!` }, { status: 400 });
        }

        const checkRate = newRate !== undefined && newRate !== "" ? parseFloat(newRate) : targetUser.otpRate;
        let agentLimit = Math.max(newAgent.agentMaxRate || 0, newAgent.otpRate || 0);
        if (agentLimit === 0) agentLimit = 0.70; 

        if (checkRate > agentLimit) {
          return NextResponse.json({ message: `🔴 TRANSFER FAILED: User rate (৳${checkRate}) exceeds new Agent's max limit (৳${agentLimit.toFixed(2)})!` }, { status: 400 });
        }
      }

      updateData.agentEmail = newAgent.email; 
    }

    // 💥 AGENT SECURITY CHECKS 💥
    if (realRequesterRole === "agent") {
       if (newRole === "admin") {
          return NextResponse.json({ message: "🔴 SECURITY ALERT: Agents cannot promote to Admin!" }, { status: 403 });
       }
       
       const agent = await User.findOne({ email: realRequesterEmail });

       // API TOGGLE PERMISSION CHECK
       if (isApiActive !== undefined) {
          if (!agent?.canManageApi) {
             return NextResponse.json({ message: "🔴 SECURITY ALERT: You do not have Admin permission to enable Developer API!" }, { status: 403 });
          }
          if (targetUser.agentEmail !== agent.email && targetUser.agentEmail !== agent.customAgentMail) {
             return NextResponse.json({ message: "🔴 SECURITY ALERT: This user does not belong to your network!" }, { status: 403 });
          }
          updateData.isApiActive = isApiActive;
       }

       let maxR = agent?.agentMaxRate || 0;
       let otpR = agent?.otpRate || 0;
       let agentLimit = Math.max(maxR, otpR); 
       if (agentLimit === 0) agentLimit = 0.70; 
       
       if (newRate !== undefined && newRate !== null && newRate !== "" && parseFloat(newRate) > agentLimit) {
          return NextResponse.json({ 
            message: `🔴 SECURITY ALERT: You cannot set a rate higher than ৳ ${agentLimit.toFixed(2)}` 
          }, { status: 400 });
       }
    }

    // Account Status Force Logout
    if (newStatus) {
      updateData.status = newStatus.toLowerCase();
      if (updateData.status === "banned") {
        updateData.activeSessions = [];
      }
    }
    
    if (newRate !== undefined && newRate !== null && newRate !== "") {
       updateData.otpRate = parseFloat(newRate);
       if (realRequesterRole === "admin" && isTargetAgent && !handoverToEmail) {
          updateData.agentMaxRate = parseFloat(newRate);
       }
    }
    
    if (newRole && (realRequesterRole === "admin" || (realRequesterRole === "agent" && newRole !== "admin"))) {
       updateData.role = newRole;
    }

    if (newPassword && newPassword.trim() !== "") {
      updateData.password = await bcrypt.hash(newPassword, 10);
      updateData.activeSessions = []; 
    }

    if (newPin && newPin.trim() !== "") {
      updateData.withdrawPin = newPin.trim();
    }

    if (realRequesterRole === "admin") {
      if (isApiActive !== undefined) updateData.isApiActive = isApiActive;
      if (canManageApi !== undefined && isTargetAgent) updateData.canManageApi = canManageApi;
    }

    if (isTargetAgent && newRole !== "user") {
      
      if (customMail !== undefined) {
        const trimmedMail = customMail.trim();
        if (trimmedMail !== "") {
          const isMailTaken = await User.findOne({ 
             customAgentMail: trimmedMail, 
             _id: { $ne: targetUser._id } 
          });

          if (isMailTaken) {
            return NextResponse.json({ 
               message: "🔴 ERROR: This Custom Agent Mail is already in use by another Agent!" 
            }, { status: 400 });
          }
        }
        updateData.customAgentMail = trimmedMail;
      }
      
      if (contactLink !== undefined) updateData.telegramLink = contactLink;
      if (maxLimit !== undefined && realRequesterRole === "admin") {
         updateData.agentMaxUsers = parseInt(maxLimit); 
      }
    }

    // 💥 MASTER FIX: Using realDbId instead of userId 💥
    await User.findByIdAndUpdate(realDbId, { $set: updateData }, { new: true, strict: false });

    return NextResponse.json({ message: "Account successfully updated!" }, { status: 200 });

  } catch (error: any) {
    console.error("Update User System Error:", error);
    return NextResponse.json({ message: `System Error: ${error.message}` }, { status: 500 });
  }
}