import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { brand_id } = await req.json();
    
    // Path to the JamBox root where package.json sits
    const rootDir = path.join(process.cwd(), '..');

    console.log(`[Generate API] Spawning pipeline at root: ${rootDir}`);

    // Run the pipeline using npm start
    exec(`npm start`, { cwd: rootDir }, (error, stdout, stderr) => {
        if (error) {
           console.error("❌ Background pipeline error:", error);
           console.error("❌ Background pipeline stderr:", stderr);
        }
        console.log("✅ Pipeline stdout:", stdout);
    });

    // We don't await the exec finish because it takes time and might hit Vercel function limits. 
    // We return success immediately.
    return NextResponse.json({ success: true, message: "Pipeline manually started." });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
