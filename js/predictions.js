let expenses = [];
let budget = 0;

async function loadData() {
    let snap = await window.fbFS.collection("expenses").get();

    expenses = snap.docs.map(d => d.data());

    // get budget from user
    let userSnap = await window.fbFS.collection("users").doc(gUser.uid).get();
    budget = userSnap.data().budget || 10000;

    generateAnalysis();
}

window.addEventListener("load", loadData);

// Future expense
function futureExpense() {
    let total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    let avg = total / Math.max(1, expenses.length);
    let predicted = avg * 30;

    return `₹${Math.round(predicted)}`;
}
//Budget overrun
function budgetOverrun() {
    let total = expenses.reduce((s, e) => s + Number(e.amount), 0);

    let daysLeft = 30 - new Date().getDate();
    let projected = (total / new Date().getDate()) * 30;

    if (projected > budget) {
        return `May exceed budget in ${Math.max(1, daysLeft)} days ⚠️`;
    }
    return "Safe within budget ✅";
}
// Top category
function topCategory() {
    let map = {};

    expenses.forEach(e => {
        map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });

    return Object.keys(map).reduce((a, b) => map[a] > map[b] ? a : b, "None");
}
//Recurring 
function recurring() {
    let map = {};

    expenses.forEach(e => {
        let key = e.title + e.amount;
        map[key] = (map[key] || 0) + 1;
    });

    return Object.values(map).some(v => v > 1)
        ? "Recurring payments detected 🔁"
        : "No recurring expenses";
}
// Weekly trend
function weeklyTrend() {
    let mid = Math.floor(expenses.length / 2);

    let w1 = 0, w2 = 0;

    expenses.forEach((e, i) => {
        if (i < mid) w1 += Number(e.amount);
        else w2 += Number(e.amount);
    });

    return w2 > w1 ? "Spending rising 📈" : "Spending stable 📉";
}

function generateAnalysis() {

    document.getElementById("future").innerText =
        "You may spend " + futureExpense();

    document.getElementById("budget").innerText =
        budgetOverrun();

    document.getElementById("category").innerText =
        "Top category: " + topCategory();

    document.getElementById("recurring").innerText =
        recurring();

    document.getElementById("weekly").innerText =
        weeklyTrend();
}