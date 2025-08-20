from fastapi import FastAPI, Request
import httpx
import logging
# from pydantic import BaseModel

# class BankNewCard(BaseModel):
#     cardId: str
#     customerId: str
#     customerName: str
#     mobileNumber: str
#     applicationId: str
#     address: str
#     priority: str = "STANDARD"

app = FastAPI()
logging.basicConfig(level=logging.INFO)

CARDS_BASE_URL = "http://localhost:3001/api/v1/cards"


async def forward_new_card(card_data: dict):
    async with httpx.AsyncClient() as client:
        return await client.post(CARDS_BASE_URL, json=card_data)


async def forward_card_update(card_id: str, update_data: dict):
    url = f"{CARDS_BASE_URL}/{card_id}/status"
    async with httpx.AsyncClient() as client:
        return await client.post(url, json=update_data)


def normalize_bank_new(data: dict) -> dict:
    """Extract only required fields for new card"""
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
        "message": data.get("message")
    }


# def normalize_logistics(data: dict) -> dict:
#     """Logistics payload cleanup"""
#     return {
#         "cardId": data.get("cardId"),
#         "status": data.get("status"),
#         "location": data.get("location"),
#         "message": data.get("message"),
#         "tracking_number": data.get("tracking_number")
#     }


# --- BANK ---

@app.post("/webhook/bank/new")
async def bank_new(request: Request):
    """Bank pushes new card applications"""
    data = await request.json()
    logging.info(f"📥 Bank NEW Card: {data}")
    formated_data = normalize_bank_new(data)
    print(f"data = {formated_data}")
    # resp = await forward_new_card(formated_data)
    # return {"forwarded_status": resp.status_code}


@app.post("/webhook/bank/update")
async def bank_update(request: Request):
    """Bank pushes updates for existing cards"""
    data = await request.json()
    logging.info(f"📥 Bank Card UPDATE: {data}")
    card_id = data.get("cardId")
    formated_data = normalize_update(data)
    resp = await forward_card_update(card_id, formated_data)
    return {"forwarded_status": resp.status_code}


# --- MANUFACTURER ---

@app.post("/webhook/card-manufacturer")
async def manufacturer_webhook(request: Request):
    data = await request.json()
    logging.info(f"📥 Manufacturer Update: {data}")
    card_id = data.get("cardId") or data.get("applicationId")
    formated_data = normalize_update(data)
    resp = await forward_card_update(card_id, formated_data)
    return {"forwarded_status": resp.status_code}


# --- LOGISTICS ---

@app.post("/webhook/logistics")
async def logistics_webhook(request: Request):
    data = await request.json()
    logging.info(f"📥 Logistics Update: {data}")
    card_id = data.get("cardId") or data.get("applicationId")
    formated_data = normalize_update(data)
    resp = await forward_card_update(card_id, formated_data)
    return {"forwarded_status": resp.status_code}
