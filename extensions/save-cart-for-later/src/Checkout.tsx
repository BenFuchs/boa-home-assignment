import {
  reactExtension,
  Banner,
  BlockStack,
  Checkbox,
  Button,
  Text,
  useCartLines,
  useApi,
  useCustomer,
  Image,
} from "@shopify/ui-extensions-react/checkout";
import { useEffect, useState } from "react";

export default reactExtension("purchase.checkout.block.render", () => (
  <Extension />
));

interface ProductDetails {
  title: string;
  image: string;
}

function Extension() {
  const cartLines = useCartLines(); // array of cart items
  const extension = useApi();
  const [selectedProducts, setSelectedProducts] = useState(new Map());
  const [retrievedCart, setRetrievedCart] = useState([]);
  const [cartFlag, setcartFlag] = useState<Boolean>(false);
  const customer = useCustomer();
  const customerID = customer.id;

  const handleProductToggle = (productId, quantity) => {
    setSelectedProducts((prev) => {
      const updated = new Map(prev);
      if (updated.has(productId)) {
        updated.delete(productId); 
      } else {
        updated.set(productId, quantity); 
      }
      return updated;
    });
  };

  useEffect(() => {
    console.log(selectedProducts);
  }, [selectedProducts]);

  const handleSaveCart = () => {
    const selectedItems = Array.from(selectedProducts.entries()).map(
      ([id, quantity]) => ({ id, quantity })
    );

    const data = {
      message: "test",
      selectedItems,
      customerID,
    };

    fetch("https://04a2-87-70-187-31.ngrok-free.app/saveCartData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => response.json())
      .then((responseData) => {
        console.log("Success:", responseData);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  };
  const handleRetrieveCart = () => {
    fetch("https://04a2-87-70-187-31.ngrok-free.app/retrieveCartData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ customerID }),
    })
      .then((response) => response.json())
      .then((responseData) => {
        if (responseData.items) {
          // Iterate through the items and fetch product details for each item
          const itemsWithDetailsPromises = responseData.items.map((item) =>
            fetchItemDetails(item.itemID).then((details) => ({
              ...item,
              title: details.title,
              image: details.image,
            }))
          );
  
          // Wait for all item details to be fetched
          Promise.all(itemsWithDetailsPromises)
            .then((itemsWithDetails) => {
              setRetrievedCart(itemsWithDetails); // Update the cart with detailed items
              console.log(itemsWithDetails); // Debugging line to check the updated cart
            })
            .catch((error) => {
              console.error("Error fetching item details:", error);
            });
        } else {
          console.log("No cart data found for this customer");
        }
      })
      .catch((error) => {
        console.error("Error retrieving cart data:", error);
      });
  };
  
  const fetchItemDetails = (itemID: string): Promise<ProductDetails> => {
  const query = `
    query getProductDetails($id: ID!) {
      product(id: $id) {
        title
        images(first: 1) {
          edges {
            node {
              src
            }
          }
        }
      }
    }
  `;

  return fetch("https://home-assignment-234.myshopify.com/admin/api/unstable/graphql.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": "your-access-token-here", // Replace with your token
    },
    body: JSON.stringify({
      query,
      variables: { id: itemID },
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      const product = data.data.product;
      return {
        title: product.title,
        image: product.images.edges[0]?.node.src || "", // Fallback in case there's no image
      };
    })
    .catch((error) => {
      console.error("Error fetching item details:", error);
      return { title: "", image: "" }; // Return empty details in case of an error
    });
};

  const checkUserPastCart = () => {
    console.log("Checking if the user has a past cart...");

    fetch("https://04a2-87-70-187-31.ngrok-free.app/checkUserPastCart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ customerID }),
    })
      .then((response) => {
        console.log("Response status:", response.status);
        if (!response.ok) {
          throw new Error("Failed to check user's past cart");
        }
        return response.json();
      })
      .then((responseData) => {
        console.log("Response data:", responseData);

        if (responseData.cartFlag === true) {
          setcartFlag(true);
        } else {
          setcartFlag(false);
          console.log("No cart data found for this customer");
        }
      })
      .catch((error) => {
        console.error("Error during checkUserPastCart:", error);
      });
  };


  const deleteUserSavedCart = (customerID) => {
    fetch("https://04a2-87-70-187-31.ngrok-free.app/removeSavedCartFromDB", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ customerID }),
    })
      .then((response) => {
        if (response.ok) {
          console.log("Saved cart successfully removed.");
          return response.json();
        } else if (response.status === 404) {
          console.log("No saved cart found for this customer.");
          return response.json();
        } else {
          throw new Error("Failed to remove saved cart");
        }
      })
      .then((data) => {
        console.log("Response data:", data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  };

  useEffect(() => {
    checkUserPastCart(); // Checks if a user has a cart saved, use this to render conditionally the retrieve button
  }, []);




  return (
    <BlockStack border={"dotted"} padding={"tight"}>
      <>
        <Banner title="Welcome Back!">You are logged in.</Banner>
        {cartLines.length > 0 ? (
          <>
            <BlockStack spacing="loose">
              {cartLines.map((line) => (
               <BlockStack key={line.id} spacing="tight">
               <Checkbox
                 id={`save-${line.id}`}
                 checked={selectedProducts.has(line.id)}
                 onChange={() => handleProductToggle(line.id, line.quantity)}
               />
               <Text>
                 {line.merchandise.title} - {line.quantity}
               </Text>
               {line.merchandise.image ? (
                 <Image source={line.merchandise.image.url} />
               ) : (
                 <Text>No image available</Text>
               )}
             </BlockStack>
              ))}
            </BlockStack>
            {!cartFlag && 
            <Button onPress={handleSaveCart}>Save Cart for Later</Button>
            }</>
        ) : (
          <Banner title="Your cart is empty." />
        )}

        {/* Button to retrieve cart data */}
        {cartFlag && (
          <BlockStack>
            <Button onPress={handleRetrieveCart}>Retrieve Saved Cart</Button>
          </BlockStack>
        )}
        {/* Display retrieved cart data */}
        {retrievedCart.length > 0 && (
          <BlockStack spacing="loose">
            <Text>Saved Cart Items:</Text>
            {retrievedCart.map((item) => (
              <Text key={item.itemID}>
                {item.itemID} - Quantity: {item.quantity}
              </Text>
            ))}
            <Button onPress={() => deleteUserSavedCart(customerID)}>
              Delete Saved Cart
            </Button>
          </BlockStack>
        )}
      </>
    </BlockStack>
  );
}
