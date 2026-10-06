import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET() {
  try {
    const mongoose = await connectToDatabase();
    const dbState = mongoose.connection.readyState;
    
    // 1 = connected
    if (dbState !== 1) {
      return NextResponse.json(
        { status: "unhealthy", database: "disconnected" },
        { status: "503" as unknown as number }
      );
    }

    return NextResponse.json({
      status: "ready",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "unhealthy", error: error instanceof Error ? error.message : "Database connection failed" },
      { status: 500 }
    );
  }
}
