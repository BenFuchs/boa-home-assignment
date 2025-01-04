const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const connection = mysql.createConnection({
  host: "localhost",
  port: 3333,
  user: "root",
  password: "root",
  database: "docker",
});

app.get("/", (req, res) => {
  res.status(200).send("Connected");
});

app.post("/saveCartData", (req, res) => {
  const items = req.body.selectedItems;
  const customer = req.body.customerID;

  console.log("Received customer ID:", customer);
  console.log("Received selected items:", items);

  items.forEach((item) => {
    const itemID = item.id;
    const quantity = item.quantity;

    console.log("itemID:", itemID, "quantity:", quantity);

    if (!itemID) {
      return console.error("Invalid itemID:", item);
    }

    connection.query(
      `SELECT * FROM cart_items WHERE customer_id = ? AND item_id = ?`,
      [customer, itemID],
      (err, results) => {
        if (err) {
          console.error("Error checking cart item:", err);
          return;
        }

        if (results.length > 0) {
          connection.query(
            `UPDATE cart_items SET quantity = quantity + ? WHERE customer_id = ? AND item_id = ?`,
            [quantity, customer, itemID],
            (err) => {
              if (err) {
                console.error("Error updating cart item:", err);
              } else {
                console.log("Updated item:", itemID);
              }
            }
          );
        } else {
          connection.query(
            `INSERT INTO cart_items (customer_id, item_id, quantity) VALUES (?, ?, ?)`,
            [customer, itemID, quantity],
            (err) => {
              if (err) {
                console.error("Error inserting cart item:", err);
              } else {
                console.log("Inserted item:", itemID);
              }
            }
          );
        }
      }
    );
  });

  const responseData = {
    customerID: customer,
    items: items.map((item) => ({
      itemID: item.id,
      quantity: item.quantity,
    })),
  };

  res.status(200).json(responseData);
});

app.post("/retrieveCartData", (req, res) => {
  const customerID = req.body.customerID;
  console.log("Retrieving cart data for customer ID:", customerID);

  connection.query(
    `SELECT item_id, quantity FROM cart_items WHERE customer_id = ?`,
    [customerID],
    (err, results) => {
      if (err) {
        console.error("Error retrieving cart data:", err);
        res.status(500).json({ error: "Failed to retrieve cart data" });
        return;
      }

      if (results.length > 0) {
        const cartData = results.map((row) => ({
          itemID: row.item_id,
          quantity: row.quantity,
        }));
        res.status(200).json({ customerID: customerID, items: cartData });
      } else {
        res.status(404).json({ message: "No items found for this customer" });
      }
    }
  );
});

app.post("/checkUserPastCart", (req, res) => {
  const customerID = req.body.customerID;

  console.log("Received request to check past cart for customer ID:", customerID);

  if (!customerID) {
    return res.status(400).json({ error: "Missing customerID" });
  }

  connection.query(
    `SELECT item_id FROM cart_items WHERE customer_id = ?`,
    [customerID],
    (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (results.length > 0) {
        console.log("Cart found for customer ID:", customerID);
        res.status(200).json({ cartFlag: true });
      } else {
        console.log("No cart found for customer ID:", customerID);
        res.status(200).json({ cartFlag: false });
      }
    }
  );
});

app.delete("/removeSavedCartFromDB", (req, res) => {
  const customerID = req.body.customerID;

  console.log("Received request to remove saved cart for customer ID:", customerID);

  if (!customerID) {
    return res.status(400).json({ error: "Missing customerID" });
  }

  connection.query(
    `DELETE FROM cart_items WHERE customer_id = ?`,
    [customerID],
    (err, results) => {
      if (err) {
        console.error("Error deleting cart items:", err);
        return res.status(500).json({ error: "Failed to delete saved cart" });
      }

      if (results.affectedRows > 0) {
        console.log("Deleted saved cart for customer ID:", customerID);
        res.status(200).json({ message: "Saved cart successfully removed" });
      } else {
        console.log("No saved cart found for customer ID:", customerID);
        res.status(404).json({ message: "No saved cart found for this customer" });
      }
    }
  );
});

connection.connect((error) => {
  if (error) {
    console.error("An error occurred while connecting to the database:", error.message);
    throw error;
  }

  console.log("Connected to the database successfully!");

  app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });
});
