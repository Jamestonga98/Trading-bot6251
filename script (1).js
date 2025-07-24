let ws;

let isConnected = false;

let activeBuys = 0;

let stopOnLoss = false;

const symbol = "R_100";

const APP_ID = 1089;

function log(message) {

  const logBox = document.getElementById("log");

  logBox.innerHTML += message + "<br>";

  logBox.scrollTop = logBox.scrollHeight;

}

function startWebSocket(token) {

  ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);

  ws.onopen = () => {

    log("🔌 Connected to WebSocket");

    ws.send(JSON.stringify({ authorize: token }));

  };

  ws.onmessage = (event) => {

    const data = JSON.parse(event.data);

    if (data.error) {

      log(`❌ Error: ${data.error.message}`);

      return;

    }

    if (data.msg_type === "authorize") {

      isConnected = true;

      log("✅ Authorized");

      ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));

      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));

    }

    if (data.msg_type === "balance") {

      document.getElementById("balance").innerText = `Balance: $${data.balance.balance.toFixed(2)}`;

    }

    if (data.msg_type === "tick") {

      document.getElementById("price").innerText = `Market Price: ${data.tick.quote}`;

    }

    if (data.msg_type === "proposal") {

      const rawStake = parseFloat(document.getElementById("stake").value) || 1;

      const formattedStake = rawStake.toFixed(2);

      const buyRequest = {

        buy: data.proposal.id,

        price: formattedStake

      };

      ws.send(JSON.stringify(buyRequest));

      log(`🟢 Buying Over 1 @ $${formattedStake}`);

    }

    if (data.msg_type === "buy") {

      const id = data.buy.contract_id;

      activeBuys++;

      log(`✅ Trade #${activeBuys} confirmed (TX: ${data.buy.transaction_id})`);

      // Subscribe to result of the specific contract

      ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: id, subscribe: 1 }));

    }

    if (data.msg_type === "proposal_open_contract") {

      const contract = data.proposal_open_contract;

      if (contract.is_sold) {

        const profit = contract.profit;

        const result = profit >= 0 ? "🟢 WIN" : "🔴 LOSS";

        log(`${result} | Profit: $${profit.toFixed(2)}`);

        if (profit < 0 && !stopOnLoss) {

          stopOnLoss = true;

          log("❌ Loss detected — stopping all further trades.");

        }

      }

    }

  };

  ws.onclose = () => {

    isConnected = false;

    log("🔌 Disconnected from WebSocket");

  };

}

async function placeTrades() {

  if (!isConnected) return log("⚠️ Please connect first.");

  const rawStake = parseFloat(document.getElementById("stake").value);

  if (isNaN(rawStake) || rawStake < 0.35) {

    alert("Please enter a valid stake (min $0.35)");

    return;

  }

  const stake = rawStake.toFixed(2);

  stopOnLoss = false;

  activeBuys = 0;

  log(`🚀 Starting up to 120 trades with $${stake}`);

  for (let i = 0; i < 120; i++) {

    if (stopOnLoss) {

      log("🛑 Trade stopped due to detected loss.");

      break;

    }

    const proposal = {

      proposal: 1,

      amount: stake,

      basis: "stake",

      contract_type: "DIGITOVER",

      currency: "USD",

      duration: 1,

      duration_unit: "t",

      symbol: symbol,

      barrier: 1

    };

    ws.send(JSON.stringify(proposal));

    await new Promise(resolve => setTimeout(resolve, 150)); // avoid flooding

  }

}

document.getElementById("connect").onclick = () => {

  const token = document.getElementById("token").value.trim();

  if (!token) {

    alert("Enter your Deriv API token");

    return;

  }

  startWebSocket(token);

};

document.getElementById("start").onclick = () => {

  placeTrades();

};

document.getElementById("stop").onclick = () => {

  if (ws) {

    ws.close();

    log("🛑 WebSocket manually closed");

  }

};