import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
async function actor(){const token=(await cookies()).get("mary_session")?.value;const session=token?await readSession(token):null;if(!session)return null;const user=await db.user.findUnique({where:{id:session.id},select:{id:true,role:true,suspended:true,forcePasswordChange:true}});return user&&!user.suspended&&!user.forcePasswordChange?user:null;}
const schema=z.object({invoiceId:z.string().min(1),amount:z.number().int().positive().max(100_000_000),method:z.enum(["CASH","MPESA","BANK","CHEQUE"]),mpesaCode:z.string().trim().toUpperCase().min(8).max(20).regex(/^[A-Z0-9]+$/).optional(),reference:z.string().trim().max(80).optional()}).refine(x=>x.method!=="MPESA"||Boolean(x.mpesaCode),{message:"M-Pesa code is required."});
function yearEAT(){return new Intl.DateTimeFormat("en-CA",{year:"numeric",timeZone:"Africa/Nairobi"}).format(new Date());}
export async function POST(request:Request){
 const user=await actor();if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});if(!canInScope(user.role,"payments","create","school"))return NextResponse.json({error:"Forbidden"},{status:403});let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Enter a valid amount and payment method. M-Pesa payments need a transaction code."},{status:400});const invoice=await db.feeInvoice.findUnique({where:{id:parsed.data.invoiceId},include:{lines:true}});if(!invoice)return NextResponse.json({error:"Invoice not found."},{status:404});
 try{const payment=await db.$transaction(async tx=>{const counter=await tx.receiptCounter.upsert({where:{id:"global"},create:{id:"global",lastNumber:1},update:{lastNumber:{increment:1}}});const receiptNo=`MRR-${yearEAT()}-${String(counter.lastNumber).padStart(6,"0")}`;const row=await tx.feePayment.create({data:{invoiceId:invoice.id,receiptNo,amount:parsed.data.amount,method:parsed.data.method,mpesaCode:parsed.data.method==="MPESA"?parsed.data.mpesaCode:null,reference:parsed.data.reference??null,recordedById:user.id,status:"PENDING"}});await tx.feePaymentHistory.create({data:{paymentId:row.id,actorId:user.id,version:1,amount:row.amount,method:row.method,status:row.status,reason:"Awaiting Head Teacher confirmation"}});await tx.auditEvent.create({data:{actorId:user.id,action:"PAYMENT_SUBMITTED_FOR_CONFIRMATION",entity:"FeePayment",entityId:row.id}});return row;});return NextResponse.json({payment,creditAmount:0},{status:201});}
 catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")return NextResponse.json({error:"That M-Pesa code or receipt number has already been used."},{status:409});return NextResponse.json({error:"Payment could not be recorded."},{status:400});}
}
