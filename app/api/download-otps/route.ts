import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // 💥 Internal Call to Fastify Microservice (Port 4000) 💥
        const res = await fetch("http://127.0.0.1:4000/v1/internal/download-otps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ success: false, message: "Proxy Error to Microservice" });
    }
}