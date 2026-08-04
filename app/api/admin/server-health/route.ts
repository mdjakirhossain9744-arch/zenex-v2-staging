import { NextResponse } from 'next/server';
import os from 'os';
import { execSync } from 'child_process';

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

        return NextResponse.json({
            success: true,
            cpu: cpuUsagePct,
            ram: ramUsagePct,
            ramDetails: `${usedRamGb} GB / ${totalRamGb} GB`,
            disk: diskUsagePct,
            cpuCores: cpuCount
        });
    } catch (error) {
        return NextResponse.json({ success: false, cpu: 0, ram: 0, disk: 0 });
    }
}