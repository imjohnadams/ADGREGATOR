# Adgregator

Google Sheets dashboard that totals ad spend and HubSpot application and enrollment counts for two date ranges.

## Overview

Adgregator is a bound Google Apps Script plus a sample workbook. It is for someone who already stores Google Ads, Meta, Bing, Reddit, and HubSpot records as JSON in the spreadsheet.

The workbook holds the data. `Code.gs` reads those rows and two date ranges on `Dashboard`, then writes platform spend and HubSpot counts. Spreadsheet formulas compute Total Spend, CPA, and CPE. The script does not call Google, Meta, Bing, Reddit, or HubSpot.

## Features

- Two inclusive date ranges on `Dashboard` (labeled MTD and L7D)
- Spend totals from Google, Meta, Bing, and Reddit JSON sheets
- HubSpot application and enrollment counts by `utm_medium`
- **Generate Report** menu: Refresh Dashboard and Clear Report
- Spreadsheet formulas for Total Spend, CPA, and CPE
- Missing or empty data sheets written as `0`
- Malformed JSON rows skipped

## Tech Stack

- Google Sheets — date inputs, dashboard layout, and derived formulas
- Google Apps Script — `SpreadsheetApp` and `Utilities.formatDate` in `Code.gs`
- Sample workbook — `adgregator.xlsx`

There is no local runtime, package manager, database, or environment-variable file.

## Architecture

The workbook is the data store. Each of `Google_Ads_DB`, `Meta_Ads_DB`, `Bing_Ads_DB`, `Reddit_Ads_DB`, and `Hubspot_DB` stores one JSON object per row in column A.

`refreshDashboard` reads `B2:C2` and `D2:E2` in the spreadsheet time zone, formats them as `yyyy-MM-dd`, and sums matching rows. Spend is accumulated in micros: Google `metrics.costMicros` as-is, and Meta/Bing/Reddit currency amounts multiplied by 1,000,000. The script writes those totals as currency units.

Spreadsheet formulas then compute Total Spend, CPA, and CPE from the cells the script writes. Paid Search totals Google, Bing, and Reddit. Paid Social CPA and CPE use Meta spend only.

If `Dashboard` is missing, refresh and clear throw. If either date range has an empty start or end cell, refresh throws. Malformed JSON rows are skipped with a warning.

## Getting Started

### Prerequisites

- A Google account
- Access to Google Drive and Google Sheets

### Installation

1. Upload `adgregator.xlsx` to Google Drive and open it with Google Sheets.
2. In the spreadsheet, open **Extensions → Apps Script**.
3. Replace the default script with the contents of `Code.gs` and save.
4. Reload the spreadsheet. A **Generate Report** menu appears.
5. Choose **Generate Report → Refresh Dashboard**. On first run, Google asks you to authorize the script to access the spreadsheet.

**Clear Report** clears the cells the script writes. Formula cells stay in place.

## Usage

Set the date ranges, then run **Refresh Dashboard**.

- `B2:C2` is the first range (labeled MTD).
- `D2:E2` is the second range (labeled L7D). `E2` is the formula `D2+6`, so editing `D2` keeps a seven-day window.

Both ends are inclusive. Dates are compared as `yyyy-MM-dd` strings.

The sample workbook’s default windows are 2026-05-01 through 2026-06-30 (MTD) and 2026-05-11 through 2026-05-17 (L7D). Sample JSON covers May–June 2026. Metric cells stay empty until you refresh.

### Data sheets

| Sheet | Date field | Spend field |
| --- | --- | --- |
| `Google_Ads_DB` | `segments.date` | `metrics.costMicros` (millionths of a currency unit) |
| `Meta_Ads_DB` | `date_start` | `spend` |
| `Bing_Ads_DB` | `TimePeriod` | `Spend` |
| `Reddit_Ads_DB` | `date` | `spend` |
| `Hubspot_DB` | `properties.application_date`, `properties.paid_date` | — |

Google, Bing, and Reddit spend is written under Paid Search (`B14:B16` and `E14:E16`). Meta spend is written under Paid Social (`H14` and `K14`).

HubSpot counts use `properties.utm_medium` only. `utm_source` is ignored.

- `cpc` applications and enrollments go to Paid Search (`B18:B19` and `E18:E19`).
- `paidmedia` applications and enrollments go to Paid Social (`H15:H16` and `K15:K16`).

An application is counted when `application_date` falls in the range. An enrollment is counted when `paid_date` falls in the range. The same contact can count as both.

If a data sheet is missing or empty, that source is written as `0`.

`adgregator.xlsx` is synthetic.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
