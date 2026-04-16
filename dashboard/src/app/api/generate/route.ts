import { NextResponse } from 'next/server';

export const maxDuration = 60; // Tell Vercel this function can run up to 60 seconds

export async function POST(req: Request) {
  try {
    const { brand_id } = await req.json();

    console.log(`[Generate API] Triggering pipeline for brand: ${brand_id || 'all'}`);

    // Dynamically import to avoid bundling issues; the pipeline does its own dotenv
    const { runConcurrentPipeline } = await import('../../../../src/pipeline/index');

    // Run pipeline inline — Vercel will keep the function alive for up to 60s
    await runConcurrentPipeline();

    return NextResponse.json({ success: true, message: "Pipeline completed." });

  } catch (e: any) {
    console.error("[Generate API] Pipeline error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
