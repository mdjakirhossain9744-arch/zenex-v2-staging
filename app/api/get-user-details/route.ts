import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 

export async function POST(req: Request) {
  try {
    // বডি থেকে ইমেইল নিচ্ছি
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" }, 
        { status: 400 }
      );
    }

    // ডাটাবেস কানেক্ট করছি
    await connectToDatabase();

    // ইমেইল দিয়ে ইউজারকে খুঁজছি
    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" }, 
        { status: 404 }
      );
    }

    // ইউজারের ডেটা (এবং ব্যালেন্স) ফ্রন্টএন্ডে পাঠিয়ে দিচ্ছি
    return NextResponse.json({ success: true, user });

  } catch (error) {
    console.error("Error fetching user details:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}