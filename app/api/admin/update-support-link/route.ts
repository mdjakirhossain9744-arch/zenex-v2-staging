import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Setting from "../../../../models/Setting";

export async function GET() {
  try {
    await connectToDatabase();
    // ডাটাবেস থেকে দুটো লিংকই খোঁজা হচ্ছে
    const supportSetting = await Setting.findOne({ key: "GLOBAL_SUPPORT_LINK" });
    const contactSetting = await Setting.findOne({ key: "GLOBAL_CONTACT_LINK" });
    
    return NextResponse.json({ 
      success: true, 
      supportLink: supportSetting ? supportSetting.value : "https://t.me/Zenexacademy1",
      contactLink: contactSetting ? contactSetting.value : "https://t.me/abdullah_124"
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { supportLink, contactLink } = await req.json();
    await connectToDatabase();
    
    // Support Link আপডেট
    if (supportLink) {
      await Setting.findOneAndUpdate(
        { key: "GLOBAL_SUPPORT_LINK" },
        { value: supportLink },
        { upsert: true, new: true }
      );
    }
    
    // Contact Link আপডেট
    if (contactLink) {
      await Setting.findOneAndUpdate(
        { key: "GLOBAL_CONTACT_LINK" },
        { value: contactLink },
        { upsert: true, new: true }
      );
    }
    
    return NextResponse.json({ success: true, message: "Links Updated Successfully" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}