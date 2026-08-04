import { NextResponse } from 'next/server';
import os from 'os';
import { execSync } from 'child_process';
import connectToDatabase from '../../../lib/mongodb';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. RAM Calculation
        const totalRam = os.totalmem();
        const freeRam = os.freemem();
        const usedRam = totalRam - freeRam;
        const ramUsagePct = ((usedRam / totalRam) * 100).toFixed(1);
        const totalRamGb = (totalRam / 1024 / 1024 / 1024).toFixed(1);
        const usedRamGb = (usedRam / 1024 / 1024 / 1024).toFixed(1);

        // 2. CPU Calculation (1-minute load average)
        const cpus = os.cpus();
        const cpuCount = cpus.length;
        const load = os.loadavg()[0]; 
        const cpuUsagePct = Math.min(((load / cpuCount) * 100), 100).toFixed(1);

        // 3. Disk Storage Calculation (Linux df -h command)
        let diskUsagePct = "0.0";
        try {
            const diskOutput = execSync("df -h / | awk 'NR==2 {print $5}' | sed 's/%//'").toString().trim();
            if (diskOutput && !isNaN(Number(diskOutput))) {
                diskUsagePct = Number(diskOutput).toFixed(1);
            }
        } catch (e) {
            diskUsagePct = "N/A";
        }

        // 4. 🔥 THE BOSS UPGRADE: REAL ACTIVE SESSIONS (Last 15 Minutes) 🔥
        let realActiveSessions = 0;
        try {
            await connectToDatabase();
            const db = mongoose.connection.db;
            
            // TS FIX: Check if db is defined before querying
            if (db) {
                const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
                
                // Count users who were updated or logged in within the last 15 mins
                const activeUsersCount = await db.collection("users").countDocuments({
                    $or: [
                        { updatedAt: { $gte: fifteenMinsAgo } },
                        { lastLogin: { $gte: fifteenMinsAgo } }
                    ]
                });
                realActiveSessions = activeUsersCount;
            }
        } catch (dbError) {
            console.error("Health API DB Error:", dbError);
        }

        return NextResponse.json({
            success: true,
            cpu: cpuUsagePct,
            ram: ramUsagePct,
            ramDetails: `${usedRamGb} GB / ${totalRamGb} GB`,
            disk: diskUsagePct,
            cpuCores: cpuCount,
            activeSessions: realActiveSessions
        });
    } catch (error) {
        return NextResponse.json({ success: false, cpu: 0, ram: 0, disk: 0, activeSessions: 0 });
    }
}