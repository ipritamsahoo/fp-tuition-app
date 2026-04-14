import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getLogoDataUrl(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width || 100;
            canvas.height = img.height || 100;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => reject(new Error("Failed to load logo"));
        img.src = url;
    });
}

export async function generateReceiptPDF(payment, user) {
    const doc = new jsPDF();

    // Configuration
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    // --- Header (Lite touch of Navy Blue) ---
    doc.setFillColor(241, 245, 249); // Very light blue-grey tint
    doc.rect(0, 0, pageWidth, 40, "F");

    try {
        const logoDataUrl = await getLogoDataUrl("/logo.png");
        doc.addImage(logoDataUrl, "PNG", margin, 10, 20, 20);
    } catch (e) {
        console.error("Could not load logo for PDF", e);
    }

    doc.setTextColor(0, 0, 0); // Black text
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("Future Point", margin + 25, 25);

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("FEE RECEIPT", pageWidth - margin - 50, 25);

    // ─── Student Details ───
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const startY = 55;
    doc.text("Student Details:", margin, startY);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Student Name: ${user.name}`, margin, startY + 10);

    // ─── Receipt Details ───
    const rightColX = pageWidth / 2 + 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Receipt Details:", rightColX, startY);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    // Receipt No
    doc.text(`Receipt No: ${payment.id}`, rightColX, startY + 10);

    // Date of payment approval
    let approvalDate = "N/A";
    if (payment.updated_at) {
        try {
            const d = payment.updated_at.toDate ? payment.updated_at.toDate() : new Date(payment.updated_at);
            approvalDate = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        } catch {
            approvalDate = String(payment.updated_at).substring(0, 10);
        }
    }
    doc.text(`Date of Approval: ${approvalDate}`, rightColX, startY + 18);

    // Mode of payment
    const mode = payment.mode === "offline" ? "Offline" : "Online";
    doc.text(`Mode of Payment: ${mode}`, rightColX, startY + 26);

    // If offline, show teacher name
    const tName = payment.teacher_name || payment.offline_teacher_name;
    if (payment.mode === "offline" && tName) {
        doc.text(`Received by: ${tName}`, rightColX, startY + 34);
    }

    // ─── Fee Table ───
    const tableStartY = startY + 50;
    const monthName = MONTHS[payment.month - 1] || payment.month;

    autoTable(doc, {
        startY: tableStartY,
        head: [["Description", "Month/Year", "Amount (INR)"]],
        body: [
            ["Tuition Fee", `${monthName} ${payment.year}`, `Rs. ${payment.amount}`],
        ],
        theme: "grid",
        headStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42], // Navy blue text for head
            fontStyle: "bold",
            lineWidth: 0.1,
            lineColor: [15, 23, 42], // Navy blue border
        },
        styles: {
            fontSize: 11,
            cellPadding: 6,
            textColor: [50, 50, 50],
            lineColor: [15, 23, 42], // Navy blue border for body
            lineWidth: 0.1,
        },
        columnStyles: {
            0: { cellWidth: "auto" },
            1: { cellWidth: 40 },
            2: { cellWidth: 40, halign: "right" },
        },
    });

    // ─── Totals ───
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Total Paid:", pageWidth - margin - 50, finalY);
    doc.text(`Rs. ${payment.amount}`, pageWidth - margin, finalY, { align: "right" });

    // ─── Footer ───
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    const footerY = pageHeight - 30;
    doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

    doc.text("This is a computer-generated receipt and does not require a physical signature.", pageWidth / 2, footerY, { align: "center" });
    doc.text("Thank you for your payment.", pageWidth / 2, footerY + 6, { align: "center" });

    // Download date and time
    const now = new Date();
    const downloadTime = now.toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Downloaded on: ${downloadTime}`, pageWidth / 2, footerY + 14, { align: "center" });

    // ─── Save PDF ───
    const fileName = `Fee_Receipt_${user.name.replace(/\s+/g, "_")}_${monthName}_${payment.year}.pdf`;
    doc.save(fileName);
}
