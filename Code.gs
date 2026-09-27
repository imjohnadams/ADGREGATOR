function refreshDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashboardSheet = getDashboardSheet_(ss);
  const tz = ss.getSpreadsheetTimeZone();

  const dateRanges = [
    {
      startCell: "B2",
      endCell: "C2",
      outputCells: {
        Google: "B14",
        Meta: "H14",
        Bing: "B15",
        Reddit: "B16"
      },
      hubspotOutputs: {
        cpcApplications: "B18",
        cpcEnrollments: "B19",
        paidApplications: "H15",
        paidEnrollments: "H16"
      }
    },
    {
      startCell: "D2",
      endCell: "E2",
      outputCells: {
        Google: "E14",
        Meta: "K14",
        Bing: "E15",
        Reddit: "E16"
      },
      hubspotOutputs: {
        cpcApplications: "E18",
        cpcEnrollments: "E19",
        paidApplications: "K15",
        paidEnrollments: "K16"
      }
    }
  ];

  const activeRanges = dateRanges.map((range, index) => {
    const startVal = dashboardSheet.getRange(range.startCell).getValue();
    const endVal = dashboardSheet.getRange(range.endCell).getValue();

    if (!startVal || !endVal) {
      throw new Error(
        `Date Range ${index + 1} fields are empty. Verify cells ${range.startCell}:${range.endCell}.`
      );
    }

    return {
      startISO: Utilities.formatDate(new Date(startVal), tz, "yyyy-MM-dd"),
      endISO: Utilities.formatDate(new Date(endVal), tz, "yyyy-MM-dd"),
      outputs: range.outputCells,
      hubspotOutputs: range.hubspotOutputs
    };
  });

  const platforms = [
    {
      name: "Google",
      sheetName: "Google_Ads_DB",
      dateExtractor: record => record?.segments?.date,
      microExtractor: record =>
        parseInt(record?.metrics?.costMicros || 0, 10)
    },
    {
      name: "Meta",
      sheetName: "Meta_Ads_DB",
      dateExtractor: record => record?.date_start,
      microExtractor: record =>
        Math.round(parseFloat(record?.spend || 0) * 1000000)
    },
    {
      name: "Bing",
      sheetName: "Bing_Ads_DB",
      dateExtractor: record => record?.TimePeriod,
      microExtractor: record =>
        Math.round(parseFloat(record?.Spend || 0) * 1000000)
    },
    {
      name: "Reddit",
      sheetName: "Reddit_Ads_DB",
      dateExtractor: record => record?.date,
      microExtractor: record =>
        Math.round(parseFloat(record?.spend || 0) * 1000000)
    }
  ];

  platforms.forEach(platform => {
    const dbSheet = ss.getSheetByName(platform.sheetName);
    const accumulatedMicros = Array(activeRanges.length).fill(0);
    const lastRow = dbSheet ? dbSheet.getLastRow() : 0;

    if (lastRow > 0) {
      const dbValues = dbSheet.getRange(1, 1, lastRow, 1).getValues();

      for (let i = 0; i < dbValues.length; i++) {
        const rawLine = String(dbValues[i][0]).trim();
        if (!rawLine) continue;

        try {
          const record = JSON.parse(rawLine);
          const recordDateStr = platform.dateExtractor(record);
          if (!recordDateStr) continue;

          activeRanges.forEach((range, rangeIdx) => {
            if (
              recordDateStr >= range.startISO &&
              recordDateStr <= range.endISO
            ) {
              accumulatedMicros[rangeIdx] += platform.microExtractor(record);
            }
          });
        } catch (error) {
          console.warn(
            `Skipping malformed row ${i + 1} on ${platform.sheetName}: ${error.message}`
          );
        }
      }
    }

    activeRanges.forEach((range, rangeIdx) => {
      const outputCell = range.outputs[platform.name];
      if (!outputCell) return;

      const usd = accumulatedMicros[rangeIdx] / 1000000;

      dashboardSheet
        .getRange(outputCell)
        .setValue(usd)
        .setNumberFormat("$#,##0.00");
    });
  });

  const counters = activeRanges.map(() => ({
    cpcApplications: 0,
    cpcEnrollments: 0,
    paidApplications: 0,
    paidEnrollments: 0
  }));

  const hubspotSheet = ss.getSheetByName("Hubspot_DB");
  const hubspotLastRow = hubspotSheet ? hubspotSheet.getLastRow() : 0;

  if (hubspotLastRow > 0) {
    const values = hubspotSheet.getRange(1, 1, hubspotLastRow, 1).getValues();

    for (let i = 0; i < values.length; i++) {
      const raw = String(values[i][0]).trim();
      if (!raw) continue;

      try {
        const record = JSON.parse(raw);

        const props = record.properties || {};

        const utmMedium = (props.utm_medium || "").toLowerCase();
        const applicationDate = props.application_date || "";
        const paidDate = props.paid_date || "";

        activeRanges.forEach((range, idx) => {

          if (
            utmMedium === "cpc" &&
            applicationDate &&
            applicationDate >= range.startISO &&
            applicationDate <= range.endISO
          ) {
            counters[idx].cpcApplications++;
          }

          if (
            utmMedium === "cpc" &&
            paidDate &&
            paidDate >= range.startISO &&
            paidDate <= range.endISO
          ) {
            counters[idx].cpcEnrollments++;
          }

          if (
            utmMedium === "paidmedia" &&
            applicationDate &&
            applicationDate >= range.startISO &&
            applicationDate <= range.endISO
          ) {
            counters[idx].paidApplications++;
          }

          if (
            utmMedium === "paidmedia" &&
            paidDate &&
            paidDate >= range.startISO &&
            paidDate <= range.endISO
          ) {
            counters[idx].paidEnrollments++;
          }

        });

      } catch (error) {
        console.warn(
          `Skipping malformed HubSpot row ${i + 1}: ${error.message}`
        );
      }
    }
  }

  activeRanges.forEach((range, idx) => {
    dashboardSheet
      .getRange(range.hubspotOutputs.cpcApplications)
      .setValue(counters[idx].cpcApplications)
      .setNumberFormat("0");

    dashboardSheet
      .getRange(range.hubspotOutputs.cpcEnrollments)
      .setValue(counters[idx].cpcEnrollments)
      .setNumberFormat("0");

    dashboardSheet
      .getRange(range.hubspotOutputs.paidApplications)
      .setValue(counters[idx].paidApplications)
      .setNumberFormat("0");

    dashboardSheet
      .getRange(range.hubspotOutputs.paidEnrollments)
      .setValue(counters[idx].paidEnrollments)
      .setNumberFormat("0");
  });
}

function clearReportData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashboardSheet = getDashboardSheet_(ss);

  const rangesToClear = [
    "B14:B16",
    "B18:B19",
    "E14:E16",
    "E18:E19",
    "H14:H16",
    "K14:K16"
  ];

  rangesToClear.forEach(range => {
    dashboardSheet.getRange(range).clearContent();
  });
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Generate Report")
    .addItem("Refresh Dashboard", "refreshDashboard")
    .addItem("Clear Report", "clearReportData")
    .addToUi();
}

function getDashboardSheet_(ss) {
  const dashboardSheet = ss.getSheetByName("Dashboard");
  if (!dashboardSheet) {
    throw new Error('Sheet "Dashboard" was not found.');
  }
  return dashboardSheet;
}
