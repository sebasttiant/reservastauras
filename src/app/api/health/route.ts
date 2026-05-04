import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  
  try {
    // Verificar conexión a DB con query mínima
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - start;
    
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: "ok",
          responseTimeMs: responseTime,
        },
      },
    });
  } catch (error) {
    const responseTime = Date.now() - start;
    const message = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: "error",
          responseTimeMs: responseTime,
          error: message,
        },
      },
    }, { status: 503 });
  }
}