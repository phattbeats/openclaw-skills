"use strict";
/**
 * Pricing command: users.getPricing
 */

const { apiCall } = require("../lib/client.js");
const { output, printTable, handleError } = require("../lib/envelope.js");

function registerPricing(program) {
  program
    .command("pricing")
    .description("Get domain pricing info from Namecheap")
    .option("--tld <tld>", "Filter by TLD (e.g. com, tech, io)")
    .option(
      "--action <action>",
      "Action type: REGISTER, RENEW, REACTIVATE, TRANSFER",
      "REGISTER"
    )
    .action(async (opts) => {
      try {
        const params = {
          ProductType: "DOMAIN",
          ActionName: opts.action.toUpperCase(),
        };
        if (opts.tld) params.ProductName = opts.tld.toLowerCase();

        const resp = await apiCall("users.getPricing", params);

        const products = resp.all("Product").map((p) => {
          const pAttrs = p.attrs();
          const prices = p.all("Price").map((pr) => pr.attrs());
          const cheapest = prices.sort(
            (a, b) => parseFloat(a.YourPrice || "0") - parseFloat(b.YourPrice || "0")
          )[0];
          return {
            TLD: pAttrs.Name || "",
            Duration: cheapest ? `${cheapest.Duration}yr` : "",
            YourPrice: cheapest ? `$${cheapest.YourPrice}` : "",
            RegularPrice: cheapest ? `$${cheapest.RegularPrice}` : "",
            Currency: cheapest ? (cheapest.Currency || "USD") : "",
          };
        });

        output(
          () => {
            console.log(`\nPricing (${opts.action.toUpperCase()}):\n`);
            if (products.length === 0) {
              console.log(
                "No pricing data returned.\n" +
                "Try: namecheap pricing --tld com\n" +
                "     namecheap pricing --tld tech\n"
              );
            } else {
              printTable(products, ["TLD", "Duration", "YourPrice", "RegularPrice", "Currency"]);
              console.log();
            }
          },
          products
        );
      } catch (err) {
        handleError(err);
      }
    });
}

module.exports = { registerPricing };
