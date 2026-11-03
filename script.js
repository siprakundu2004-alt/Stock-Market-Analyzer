const API_URL = "https://www.alphavantage.co/query";

// Put your NEW Alpha Vantage key here
const API_KEY = "4SP8OO3WMP4T721B";

let currentSymbol = "";
let stockChart = null;

let watchlist = [];

try {
    watchlist = JSON.parse(
        localStorage.getItem("stockWatchlist") || "[]"
    );

    if (!Array.isArray(watchlist)) {
        watchlist = [];
    }

} catch (error) {
    watchlist = [];
}


/* =========================================================
   DOM
========================================================= */

const stockDetails =
    document.getElementById("stockDetails");

const watchlistBtn =
    document.getElementById("watchlistBtn");

const watchlistContainer =
    document.getElementById("watchlistContainer");

const stockInput =
    document.getElementById("stockInput");

const searchBtn =
    document.getElementById("searchBtn");

const loading =
    document.getElementById("loading");

const errorMessage =
    document.getElementById("errorMessage");


/* =========================================================
   SEARCH BUTTON
========================================================= */

if (searchBtn) {

    searchBtn.addEventListener("click", () => {

        const symbol =
            stockInput.value.trim();

        if (!symbol) {
            showError("Please enter a stock symbol.");
            return;
        }

        searchStock(symbol);
    });
}


/* =========================================================
   ENTER KEY
========================================================= */

if (stockInput) {

    stockInput.addEventListener("keydown", event => {

        if (event.key === "Enter") {

            event.preventDefault();

            const symbol =
                stockInput.value.trim();

            if (!symbol) {
                showError("Please enter a stock symbol.");
                return;
            }

            searchStock(symbol);
        }
    });
}


/* =========================================================
   SEARCH STOCK
========================================================= */

async function searchStock(symbol) {

    symbol =
        String(symbol || "")
            .trim()
            .toUpperCase();

    if (!symbol) {
        showError("Please enter a stock symbol.");
        return;
    }

    currentSymbol = symbol;

    clearError();

    showLoading(true);

    try {

        /*
         * ONE API REQUEST ONLY
         */

        const url =
            `${API_URL}?function=TIME_SERIES_DAILY` +
            `&symbol=${encodeURIComponent(symbol)}` +
            `&outputsize=compact` +
            `&apikey=${encodeURIComponent(API_KEY)}`;

        const response =
            await fetch(url);

        if (!response.ok) {
            throw new Error(
                `HTTP error ${response.status}`
            );
        }

        const data =
            await response.json();

        console.log("Alpha Vantage:", data);


        /* =================================================
           API ERROR
        ================================================= */

        if (data["Error Message"]) {

            throw new Error(
                "Invalid stock symbol. Please check the symbol."
            );
        }


        if (data["Note"]) {

            throw new Error(
                "Alpha Vantage free API limit reached. " +
                "Please wait and try again later."
            );
        }


        if (data["Information"]) {

            throw new Error(
                data["Information"]
            );
        }


        /* =================================================
           TIME SERIES
        ================================================= */

        const timeSeries =
            data["Time Series (Daily)"];

        if (!timeSeries) {

            throw new Error(
                "No stock data was returned."
            );
        }


        /* =================================================
           CONVERT DATA
        ================================================= */

        const entries =
            Object.entries(timeSeries)
                .sort(
                    (a, b) =>
                        new Date(a[0]) -
                        new Date(b[0])
                );


        if (!entries.length) {

            throw new Error(
                "No historical data available."
            );
        }


        /*
         * Latest trading day
         */

        const latest =
            entries[entries.length - 1];


        const latestDate =
            latest[0];

        const latestData =
            latest[1];


        /* =================================================
           STOCK DATA
        ================================================= */

        const currentPrice =
            Number(latestData["4. close"]);

        const open =
            Number(latestData["1. open"]);

        const high =
            Number(latestData["2. high"]);

        const low =
            Number(latestData["3. low"]);

        const volume =
            Number(latestData["5. volume"]);


        /*
         * Previous trading day
         */

        const previous =
            entries.length >= 2
                ? Number(
                    entries[
                        entries.length - 2
                    ][1]["4. close"]
                )
                : currentPrice;


        const change =
            currentPrice - previous;

        const changePercent =
            previous !== 0
                ? (change / previous) * 100
                : 0;


        /* =================================================
           DISPLAY
        ================================================= */

        displayStockData({

            symbol,

            date: latestDate,

            currentPrice,

            open,

            high,

            low,

            previousClose: previous,

            change,

            changePercent,

            volume

        });


        /*
         * Last 30 trading days
         */

        const chartEntries =
            entries.slice(-30);


        const dates =
            chartEntries.map(
                entry => {

                    const date =
                        new Date(
                            entry[0] +
                            "T00:00:00"
                        );

                    return date.toLocaleDateString(
                        "en-US",
                        {
                            month: "short",
                            day: "numeric"
                        }
                    );
                }
            );


        const prices =
            chartEntries.map(
                entry =>
                    Number(
                        entry[1]["4. close"]
                    )
            );


        createStockChart(
            dates,
            prices
        );


        if (stockDetails) {

            stockDetails.classList.remove(
                "hidden"
            );
        }


        updateWatchButton();


    } catch (error) {

        console.error(error);

        showError(
            error.message ||
            "Unable to retrieve stock data."
        );

    } finally {

        showLoading(false);
    }
}


/* =========================================================
   DISPLAY STOCK
========================================================= */

function displayStockData(data) {

    document.getElementById(
        "companyName"
    ).textContent =
        data.symbol;

    document.getElementById(
        "stockSymbol"
    ).textContent =
        data.symbol +
        " • " +
        data.date;

    document.getElementById(
        "currentPrice"
    ).textContent =
        formatPrice(data.currentPrice);

    document.getElementById(
        "priceChange"
    ).textContent =
        formatChange(data.change) +
        " (" +
        data.changePercent.toFixed(2) +
        "%)";

    document.getElementById(
        "openPrice"
    ).textContent =
        formatPrice(data.open);

    document.getElementById(
        "highPrice"
    ).textContent =
        formatPrice(data.high);

    document.getElementById(
        "lowPrice"
    ).textContent =
        formatPrice(data.low);

    document.getElementById(
        "previousClose"
    ).textContent =
        formatPrice(data.previousClose);

    document.getElementById(
        "volume"
    ).textContent =
        formatVolume(data.volume);
}


/* =========================================================
   CHART
========================================================= */

function createStockChart(
    dates,
    prices
) {

    const canvas =
        document.getElementById(
            "stockChart"
        );

    if (!canvas) return;

    if (
        typeof Chart === "undefined"
    ) {

        showError(
            "Chart.js is not loaded."
        );

        return;
    }


    if (stockChart) {

        stockChart.destroy();

        stockChart = null;
    }


    const ctx =
        canvas.getContext("2d");


    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            400
        );

    gradient.addColorStop(
        0,
        "rgba(56,189,248,0.25)"
    );

    gradient.addColorStop(
        1,
        "rgba(56,189,248,0)"
    );


    stockChart =
        new Chart(
            ctx,
            {

                type: "line",

                data: {

                    labels: dates,

                    datasets: [

                        {

                            label:
                                currentSymbol +
                                " Closing Price",

                            data: prices,

                            borderColor:
                                "#38bdf8",

                            backgroundColor:
                                gradient,

                            borderWidth: 3,

                            pointRadius: 2,

                            pointHoverRadius: 6,

                            tension: 0.35,

                            fill: true

                        }

                    ]

                },


                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    interaction: {

                        mode: "index",

                        intersect: false

                    },


                    plugins: {

                        legend: {

                            labels: {

                                color:
                                    "#94a3b8"

                            }

                        },


                        tooltip: {

                            callbacks: {

                                label:
                                    context =>
                                        ` Price: $${Number(
                                            context.raw
                                        ).toFixed(2)}`

                            }

                        }

                    },


                    scales: {

                        x: {

                            ticks: {

                                color:
                                    "#64748b",

                                maxTicksLimit: 10

                            },

                            grid: {

                                color:
                                    "rgba(148,163,184,0.05)"

                            }

                        },


                        y: {

                            ticks: {

                                color:
                                    "#64748b",

                                callback:
                                    value =>
                                        "$" +
                                        Number(
                                            value
                                        ).toFixed(2)

                            },

                            grid: {

                                color:
                                    "rgba(148,163,184,0.05)"

                            }

                        }

                    }

                }

            }
        );
}


/* =========================================================
   WATCHLIST
========================================================= */

if (watchlistBtn) {

    watchlistBtn.addEventListener(
        "click",
        () => {

            if (!currentSymbol) {

                showError(
                    "Search a stock first."
                );

                return;
            }


            if (
                watchlist.includes(
                    currentSymbol
                )
            ) {

                removeFromWatchlist(
                    currentSymbol
                );

            } else {

                watchlist.push(
                    currentSymbol
                );

                saveWatchlist();

                displayWatchlist();

                updateWatchButton();
            }
        }
    );
}


function saveWatchlist() {

    localStorage.setItem(
        "stockWatchlist",
        JSON.stringify(watchlist)
    );
}


function displayWatchlist() {

    if (!watchlistContainer) return;

    watchlistContainer.innerHTML = "";


    if (!watchlist.length) {

        watchlistContainer.innerHTML = `
            <p class="empty-message">
                Your watchlist is empty.
                Search a stock and add it here.
            </p>
        `;

        return;
    }


    watchlist.forEach(symbol => {

        const item =
            document.createElement("div");

        item.className =
            "watch-item";


        const symbolElement =
            document.createElement("span");

        symbolElement.className =
            "watch-symbol";

        symbolElement.textContent =
            "📊 " + symbol;


        const removeButton =
            document.createElement("button");

        removeButton.className =
            "watch-remove";

        removeButton.textContent =
            "Remove";


        symbolElement.addEventListener(
            "click",
            () => {

                stockInput.value =
                    symbol;

                searchStock(symbol);

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );


        removeButton.addEventListener(
            "click",
            () => {

                removeFromWatchlist(
                    symbol
                );
            }
        );


        item.appendChild(
            symbolElement
        );

        item.appendChild(
            removeButton
        );

        watchlistContainer.appendChild(
            item
        );

    });
}


function removeFromWatchlist(symbol) {

    watchlist =
        watchlist.filter(
            item =>
                item !== symbol
        );

    saveWatchlist();

    displayWatchlist();

    updateWatchButton();
}


function updateWatchButton() {

    if (!watchlistBtn) return;


    if (
        currentSymbol &&
        watchlist.includes(
            currentSymbol
        )
    ) {

        watchlistBtn.textContent =
            "❌ Remove from Watchlist";

    } else {

        watchlistBtn.textContent =
            "⭐ Add to Watchlist";
    }
}


/* =========================================================
   UI HELPERS
========================================================= */

function showLoading(status) {

    if (loading) {

        loading.style.display =
            status ? "flex" : "none";
    }


    if (searchBtn) {

        searchBtn.disabled =
            status;
    }
}


function showError(message) {

    if (errorMessage) {

        errorMessage.textContent =
            message;
    }
}


function clearError() {

    if (errorMessage) {

        errorMessage.textContent = "";
    }
}


function formatPrice(value) {

    const number =
        Number(value);

    if (isNaN(number)) {
        return "N/A";
    }

    return "$" +
        number.toFixed(2);
}


function formatChange(value) {

    const number =
        Number(value);

    if (isNaN(number)) {
        return "N/A";
    }

    if (number > 0) {
        return "+" +
            number.toFixed(2);
    }

    return number.toFixed(2);
}


function formatVolume(value) {

    const number =
        Number(value);

    if (isNaN(number)) {
        return "N/A";
    }

    if (number >= 1000000000) {

        return (
            number / 1000000000
        ).toFixed(2) + "B";
    }

    if (number >= 1000000) {

        return (
            number / 1000000
        ).toFixed(2) + "M";
    }

    if (number >= 1000) {

        return (
            number / 1000
        ).toFixed(2) + "K";
    }

    return number.toLocaleString();
}


/* =========================================================
   QUICK SEARCH
========================================================= */

function quickSearch(symbol) {

    if (stockInput) {

        stockInput.value =
            symbol;
    }

    searchStock(symbol);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


window.searchStock =
    searchStock;

window.quickSearch =
    quickSearch;


displayWatchlist();

updateWatchButton();