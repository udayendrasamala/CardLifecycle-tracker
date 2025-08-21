from fastapi import FastAPI, Request, HTTPException
import httpx
import logging
import json
from typing import Dict, Any

app = FastAPI(title="Card Lifecycle Webhook Service", version="1.0.0")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("webhook")

CARDS_BASE_URL = "http://localhost:3001/api/v1/cards"
API_KEY = "commonmannotrequired"
TIMEOUT = 30.0


def clean_json_text(text: str) -> str:
    """Clean Unicode smart quotes that cause JSON parsing issues"""
    return (text
            .replace('"', '"')  # Left double quote
            .replace('"', '"')  # Right double quote
            .replace(''', "'")  # Left single quote
            .replace(''', "'")  # Right single quote
            )


async def safe_parse_json(request: Request) -> Dict[str, Any]:
    """Safely parse JSON with Unicode cleanup and error handling"""
    try:
        raw_body = await request.body()
        raw_text = raw_body.decode('utf-8')
        cleaned_text = clean_json_text(raw_text)
        
        if cleaned_text != raw_text:
            logger.info("🧹 Cleaned Unicode characters from JSON")
            
        return json.loads(cleaned_text)
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON parsing failed: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Request parsing error: {e}")
        raise HTTPException(status_code=400, detail=f"Request error: {str(e)}")


async def forward_new_card(card_data: dict):
    """Forward new card data with proper error handling"""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(CARDS_BASE_URL, json=card_data)
            logger.info(f"✅ New card forwarded: {response.status_code}")
            return response
    except httpx.TimeoutException:
        logger.error("⏰ Timeout forwarding new card")
        raise HTTPException(status_code=504, detail="Request timeout")
    except httpx.ConnectError:
        logger.error("🔌 Connection failed to cards service")
        raise HTTPException(status_code=503, detail="Cards service unavailable")
    except Exception as e:
        logger.error(f"💥 Error forwarding new card: {e}")
        raise HTTPException(status_code=500, detail=f"Forward error: {str(e)}")


async def forward_card_update(card_id: str, update_data: dict):
    """Forward card update with proper error handling"""
    if not card_id:
        raise HTTPException(status_code=400, detail="Card ID is required")
        
    url = f"{CARDS_BASE_URL}/{card_id}/status"
    logger.info(f"📤 Forwarding to: {url}")
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(
                url,
                json=update_data,
                headers={"X-API-Key": API_KEY}
            )
            logger.info(f"✅ Card update forwarded: {response.status_code}")
            return response
    except httpx.TimeoutException:
        logger.error("⏰ Timeout forwarding card update")
        raise HTTPException(status_code=504, detail="Request timeout")
    except httpx.ConnectError:
        logger.error("🔌 Connection failed to cards service")
        raise HTTPException(status_code=503, detail="Cards service unavailable")
    except Exception as e:
        logger.error(f"💥 Error forwarding card update: {e}")
        raise HTTPException(status_code=500, detail=f"Forward error: {str(e)}")


def normalize_bank_new(data: dict) -> dict:
    """Extract only required fields for new card"""
    # Validate required fields
    required_fields = ["cardId", "customerId", "customerName", "mobileNumber"]
    missing_fields = [field for field in required_fields if not data.get(field)]
    if missing_fields:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required fields: {', '.join(missing_fields)}"
        )
    
    return {
        "cardId": data.get("cardId"),
        "customerId": data.get("customerId"),
        "customerName": data.get("customerName"),
        "mobileNumber": data.get("mobileNumber"),
        "panMasked": data.get("panMasked"),
        "applicationId": data.get("applicationId"),
        "priority": data.get("priority", "STANDARD"),
        "address": data.get("address")
    }


def normalize_update(data: dict) -> dict:
    """Extract only required fields for status updates"""
    return {
        "status": data.get("status"),
        "source": data.get("source"),
        "location": data.get("location"),
        "operatorId": data.get("operatorId"),
        "batchId": data.get("batchId"),
        "message": data.get("message"),
        "trackingId": data.get("trackingId"),  # Added tracking support
        "failureReason": data.get("failureReason")  # Added failure reason
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """Service health check"""
    return {"status": "healthy", "service": "webhook-service", "version": "1.0.0"}


# --- BANK ENDPOINTS ---

@app.post("/webhook/bank/new")
async def bank_new(request: Request):
    """Bank pushes new card applications"""
    try:
        data = await safe_parse_json(request)
        logger.info(f"📥 Bank NEW Card: {data}")
        
        formatted_data = normalize_bank_new(data)
        logger.info(f"📤 Normalized data: {formatted_data}")
        
        response = await forward_new_card(formatted_data)
        
        if 200 <= response.status_code < 300:
            logger.info(f"✅ Bank new card success: {formatted_data['cardId']}")
            return {
                "status": "success",
                "message": "Card created successfully",
                "cardId": formatted_data['cardId'],
                "forwarded_status": response.status_code
            }
        else:
            logger.error(f"❌ Cards service error: {response.status_code}")
            raise HTTPException(
                status_code=500, 
                detail=f"Cards service error: {response.status_code}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 Bank new card error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.post("/webhook/bank/update")
async def bank_update(request: Request):
    """Bank pushes updates for existing cards"""
    try:
        data = await safe_parse_json(request)
        logger.info(f"📥 Bank Card UPDATE: {data}")
        
        card_id = data.get("cardId")
        if not card_id:
            raise HTTPException(status_code=400, detail="cardId is required")
        
        formatted_data = normalize_update(data)
        logger.info(f"📤 Update data: {formatted_data}")
        
        response = await forward_card_update(card_id, formatted_data)
        
        if 200 <= response.status_code < 300:
            logger.info(f"✅ Bank update success: {card_id}")
            return {
                "status": "success",
                "message": "Card updated successfully",
                "cardId": card_id,
                "forwarded_status": response.status_code
            }
        else:
            logger.error(f"❌ Cards service error: {response.status_code}")
            raise HTTPException(
                status_code=500, 
                detail=f"Cards service error: {response.status_code}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 Bank update error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


# --- MANUFACTURER ENDPOINT ---

@app.post("/webhook/card-manufacturer")
async def manufacturer_webhook(request: Request):
    """Manufacturer pushes card status updates"""
    try:
        data = await safe_parse_json(request)
        logger.info(f"📥 Manufacturer Update: {data}")
        
        card_id = data.get("cardId") or data.get("applicationId")
        if not card_id:
            raise HTTPException(
                status_code=400, 
                detail="cardId or applicationId is required"
            )
        
        formatted_data = normalize_update(data)
        response = await forward_card_update(card_id, formatted_data)
        
        if 200 <= response.status_code < 300:
            logger.info(f"✅ Manufacturer update success: {card_id}")
            return {
                "status": "success",
                "message": "Manufacturer update processed",
                "cardId": card_id,
                "forwarded_status": response.status_code
            }
        else:
            logger.error(f"❌ Cards service error: {response.status_code}")
            raise HTTPException(
                status_code=500, 
                detail=f"Cards service error: {response.status_code}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 Manufacturer update error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


# --- LOGISTICS ENDPOINT ---

@app.post("/webhook/logistics")
async def logistics_webhook(request: Request):
    """Logistics provider pushes delivery updates"""
    try:
        data = await safe_parse_json(request)
        logger.info(f"📥 Logistics Update: {data}")
        
        card_id = data.get("cardId") or data.get("applicationId")
        if not card_id:
            raise HTTPException(
                status_code=400, 
                detail="cardId or applicationId is required"
            )
        
        formatted_data = normalize_update(data)
        response = await forward_card_update(card_id, formatted_data)
        
        if 200 <= response.status_code < 300:
            logger.info(f"✅ Logistics update success: {card_id}")
            return {
                "status": "success",
                "message": "Logistics update processed",
                "cardId": card_id,
                "forwarded_status": response.status_code
            }
        else:
            logger.error(f"❌ Cards service error: {response.status_code}")
            raise HTTPException(
                status_code=500, 
                detail=f"Cards service error: {response.status_code}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 Logistics update error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)