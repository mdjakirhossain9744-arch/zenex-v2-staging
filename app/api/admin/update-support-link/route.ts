import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Setting from "../../../../models/Setting";

export async function GET() {
  try {
    await connectToDatabase();
    const setting = await Setting.findOne({ key: "GLOBAL_SUPPORT_LINK" });
    const link = setting ? setting.value : "https://t.me/Zenexacademy1";
    return NextResponse.json({ success: true, link });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { link } = await req.json();
    await connectToDatabase();
    await Setting.findOneAndUpdate(
      { key: "GLOBAL_SUPPORT_LINK" },
      { value: link },
      { upsert: true, new: true }
    );
    return NextResponse.json({ success: true, message: "Link Updated" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}