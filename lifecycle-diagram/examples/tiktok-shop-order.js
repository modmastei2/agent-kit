// Reference example: a real page built with this skill (TikTok Shop order lifecycle).
// Shows every feature: effects, mapped status, webhook + API payload cards, outcomes, basics, nav.
window.DATA = (function(){
const DETAIL = {
  title:'Get Order Detail — อ่านสถานะจริงของ order', method:'GET', path:'/order/202507/orders?ids=…', tag:'repo',
  note:'แหล่งความจริงของสถานะ ใช้หลังได้ webhook หรือระหว่างรอบ reconcile · ขอได้สูงสุด <b>50 id ต่อครั้ง</b> คั่นด้วย comma ใน query ไม่ใช่ body · <code>status</code> เป็น string enum (ตั้งแต่ 202309)',
  req:`GET https://open-api.tiktokglobalshop.com/order/202507/orders
    ?app_key=<app_key>
    &timestamp=<unix-seconds>
    &shop_cipher=<shop_cipher>
    &ids=576461413038785752,576461413038785753
    &sign=<hmac-hex-lower>
x-tts-access-token: <access_token>
content-type: application/json`,
  res:`{
  "code": 0,
  "message": "Success",
  "request_id": "2024…",
  "data": {
    "orders": [{
      "id": "576461413038785752",
      "status": "AWAITING_SHIPMENT",
      "user_id": "7021436810468230477",
      "create_time": 1690451136,        // [UNVERIFIED] unix วินาที
      "update_time": 1690453136,        // [UNVERIFIED]
      "is_cod": false,
      "cancellation_initiator": "",
      "payment": {
        "currency": "THB",
        "sub_total": "100.00",
        "shipping_fee": "10.00",
        "seller_discount": "0.00",
        "platform_discount": "0.00",
        "total_amount": "110.00"
      },
      "recipient_address": { "name": "…", "postal_code": "10110", "district_info": [ … ] },
      "packages": [{ "id": "1153…" }],
      "line_items": [{
        "id": "577…",                   // ไม่มี quantity — 1 แถว = 1 ชิ้น [UNVERIFIED]
        "product_id": "1729…",
        "sku_id": "1729…",
        "seller_sku": "SHIRT-RED-M",
        "original_price": "100.00",
        "sale_price": "90.00",
        "display_status": "AWAITING_SHIPMENT",
        "package_id": "1153…"
      }]
    }]
  }
}`};
const SEARCH = {
  title:'Search Orders — รอบ reconcile', method:'POST', path:'/order/202309/orders/search', tag:'repo',
  note:'webhook ไม่ใช่แหล่งความจริงเดียว ต้องกวาดซ้ำตาม <code>update_time</code> · <b>ต้องส่ง sort_field=update_time&amp;sort_order=ASC เอง</b> ค่าเริ่มต้นเรียง create_time DESC ทำให้ cursor ข้ามออเดอร์เงียบ ๆ (ticket 042) · pagination แบบ page_token ไม่มีเพดาน offset',
  req:`POST /order/202309/orders/search
    ?app_key=…&timestamp=…&shop_cipher=…&sign=…
    &page_size=50
    &sort_field=update_time&sort_order=ASC
    &page_token=<จากหน้าก่อน>

{
  "update_time_ge": 1718300000,
  "update_time_lt": 1718904800
}`,
  res:`{
  "code": 0,
  "data": {
    "orders": [ { "id": "5764…", "status": "IN_TRANSIT", "update_time": 1718305585, … } ],
    "next_page_token": "aDU2…",   // ว่าง = หมดหน้า
    "total_count": 128
  }
}`};
const WH = (status, note) => ({
  title:'ORDER_STATUS_CHANGE', method:'PUSH', path:'POST → https://<your-domain>/webhooks/tiktok', tag:'doc',
  note:(note ? note + ' · ' : '') + 'ตรวจ <code>Authorization</code> บน raw body ก่อน parse → เก็บดิบ → ตอบ <b>200 body ว่างภายใน 3 วินาที</b> · ใช้ <code>tts_notification_id</code> กันซ้ำ, <code>shop_id</code> หาร้าน · payload บอกแค่ "มีการเปลี่ยน" ต้องไปดึง Get Order Detail ต่อ',
  req:`POST /webhooks/tiktok
Authorization: <hex(HMAC-SHA256(app_secret, app_key + raw_body))>
Content-Type: application/json

{
  "type": 1,
  "tts_notification_id": "7380066284010030890",
  "shop_id": "7495540735365777507",
  "timestamp": 1718305585,
  "data": {
    "order_id": "576653688135258178",
    "order_status": "${status}",
    "update_time": 1718305585
  }
}`, reqLabel:'ที่เราจะได้รับ', res:`HTTP/1.1 200 OK
Content-Length: 0`, resLabel:'ที่เราต้องตอบ'});
const CANCEL = {
  title:'Cancel Order — ร้านขอยกเลิก', method:'POST', path:'/return_refund/202602/cancellations', tag:'doc',
  note:'ยกเลิกได้เฉพาะออเดอร์ที่ <b>ยังไม่ส่ง</b> (ON_HOLD / AWAITING_SHIPMENT / AWAITING_COLLECTION) · ร้านยกเลิกออเดอร์ UNPAID ไม่ได้ · ยกเลิกบางชิ้นทำได้แค่ US/UK ไทยไม่ได้ · body ด้านล่างเป็นรูปทั่วไป ต้องเช็กชื่อฟิลด์กับเอกสาร',
  req:`POST /return_refund/202602/cancellations?app_key=…&timestamp=…&shop_cipher=…&sign=…

{
  "order_id": "576653688135258178",
  "cancel_reason": "seller_cancel_reason_out_of_stock"   // ความรู้ทั่วไป — ดึงรายการเหตุผลจาก Get Reject Reasons
}`,
  res:`{
  "code": 0,
  "data": {
    "cancel_id": "4035…",
    "cancel_status": "CANCELLATION_REQUEST_COMPLETE"    // ความรู้ทั่วไป
  }
}`};
const SHIP = {
  title:'Ship Package — นัดขนส่ง (arrange shipment)', method:'POST', path:'/fulfillment/202309/packages/{package_id}/ship', tag:'doc',
  note:'ไทย <b>ไม่ต้องสร้าง package เอง</b> — TikTok สร้างให้ตั้งแต่มีออเดอร์ เอา <code>packages[].id</code> จาก Get Order Detail · Create Packages ทั้ง 202309/202512 ใช้กับไทยไม่ได้ · ยิงซ้ำได้ <code>21008099</code> "Package has been shipped" · <code>self_shipment</code> ใช้เฉพาะร้านส่งเอง',
  req:`POST /fulfillment/202309/packages/1153…/ship?app_key=…&timestamp=…&shop_cipher=…&sign=…

{
  "handover_method": "PICKUP",            // หรือ DROP_OFF
  "pickup_slot": { "start_time": 1623812664, "end_time": 1623816264 },
  "self_shipment": {                      // เฉพาะ SEND_BY_SELLER
    "tracking_number": "JX12345",
    "shipping_provider_id": "6617675021119438849"
  }
}`,
  res:`{ "code": 0, "data": {}, "message": "Success", "request_id": "…" }`};
const BATCH = {
  title:'Batch Ship Packages — นัดหลายพัสดุทีเดียว', method:'POST', path:'/fulfillment/202309/packages/ship', tag:'doc',
  note:'<b>code = 0 ไม่ได้แปลว่าผ่านหมด</b> ต้องไล่ <code>data.errors[]</code> ทีละพัสดุ',
  req:`{
  "packages": [
    { "id": "1153…", "handover_method": "PICKUP", "pickup_slot": { "start_time": 1623812664, "end_time": 1623816264 } },
    { "id": "1154…", "handover_method": "DROP_OFF" }
  ]
}`,
  res:`{
  "code": 0,
  "data": {
    "errors": [
      { "code": 10007014, "message": "package in freeze status", "detail": { "package_id": "123123123123131" } }
    ]
  },
  "message": "Success"
}`};
const DOC = {
  title:'Get Package Shipping Document — ใบปะหน้า', method:'GET', path:'/fulfillment/202309/packages/{package_id}/shipping_documents', tag:'doc',
  note:'ต้อง Ship Package ก่อน (ไม่งั้นได้ <code>21023035</code>) · <code>doc_url</code> <b>ใช้ได้ 24 ชั่วโมง</b> · ขอได้ทีละพัสดุ ไม่มี batch · หลังขนส่งรับของแล้วขอไม่ได้ (<code>21042102</code>)',
  req:`GET /fulfillment/202309/packages/1153…/shipping_documents
    ?document_type=SHIPPING_LABEL      // PACKING_SLIP, SHIPPING_LABEL_AND_PACKING_SLIP, …
    &document_size=A6                  // A6 (default) | A5
    &document_format=PDF
    &app_key=…&timestamp=…&shop_cipher=…&sign=…`,
  res:`{
  "code": 0,
  "data": {
    "doc_url": "https://…/wsos641232",
    "tracking_number": "752455325694"
  },
  "message": "Success"
}`};
const PKG = {
  title:'Get Package Detail — สถานะระดับพัสดุ', method:'GET', path:'/fulfillment/202309/packages/{package_id}', tag:'doc',
  note:'สถานะพัสดุแยกจากสถานะออเดอร์ · ใช้ดูข้อยกเว้นของขนส่ง',
  res:`{
  "code": 0,
  "data": {
    "package_status": "FULFILLING",       // TO_FULFILL | PROCESSING | FULFILLING | COMPLETED | CANCELLED
    "package_sub_status": "SHIP_EXCEPTION",
    "ship_exception_reason": "RETURNED_TO_SHIPPER",  // PACKAGE_DAMAGAED | PACKAGE_LOST | PACKAGE_SCRAP
    "shipping_type": "TIKTOK",            // TIKTOK | SELLER
    "shipping_provider_name": "Flash Express",
    "tracking_number": "TH…",
    "handover_method": "PICKUP",
    "order_line_item_ids": ["577…"]
  }
}`};
const CANCEL_WH = {
  title:'CANCELLATION_STATUS_CHANGE', method:'PUSH', path:'POST → https://<your-domain>/webhooks/tiktok', tag:'gen',
  note:'การยกเลิกเป็น workflow หลังการขายแยกจาก order_status ต้องสมัคร topic นี้ด้วย (repo สมัครแล้ว) · รูป <code>data</code> ด้านล่างเป็นความรู้ทั่วไป envelope เหมือน ORDER_STATUS_CHANGE',
  req:`{
  "type": 11,
  "tts_notification_id": "7380…",
  "shop_id": "7495540735365777507",
  "timestamp": 1718305585,
  "data": {
    "order_id": "576653688135258178",
    "cancellations_role": "BUYER",
    "cancel_status": "CANCELLATION_REQUEST_PENDING",
    "update_time": 1718305585
  }
}`, reqLabel:'ที่เราจะได้รับ'};
const RET_SEARCH = {
  title:'Search Returns — อ่านสถานะคำขอคืน', method:'POST', path:'/return_refund/202309/returns/search', tag:'gen',
  note:'สถานะคืนสินค้า <b>ไม่อยู่ใน order_status</b> ต้องอ่านจาก Return/Refund API แยก · repo ยังไม่ได้ต่อส่วนนี้ (ตาราง order status อย่างเดียวพาไปถึง return_pending/returned ไม่ได้)',
  req:`POST /return_refund/202309/returns/search?app_key=…&timestamp=…&shop_cipher=…&sign=…&page_size=50

{ "order_ids": ["576653688135258178"] }`,
  res:`{
  "code": 0,
  "data": {
    "return_orders": [{
      "return_id": "4035…",
      "order_id": "576653688135258178",
      "return_type": "RETURN_AND_REFUND",      // หรือ REFUND
      "return_status": "AWAITING_BUYER_SHIP",
      "return_line_items": [ { "order_line_item_id": "577…", "sku_id": "1729…" } ]
    }],
    "next_page_token": ""
  }
}`};
const RET_WH = {
  title:'RETURN_STATUS_CHANGE', method:'PUSH', path:'POST → https://<your-domain>/webhooks/tiktok', tag:'gen',
  note:'topic (12) ในแคตตาล็อกทางการ · รูป data เป็นความรู้ทั่วไป',
  req:`{
  "type": 12,
  "tts_notification_id": "7380…",
  "shop_id": "7495540735365777507",
  "timestamp": 1718305585,
  "data": {
    "order_id": "576653688135258178",
    "return_id": "4035…",
    "return_status": "RETURN_OR_REFUND_REQUEST_PENDING",
    "update_time": 1718305585
  }
}`, reqLabel:'ที่เราจะได้รับ'};

return {
key:'tiktok', name:'TikTok Shop',
title:'TikTok Shop Order Lifecycle', titlePrefix:'วงจรชีวิต order · ',
accent:{light:'#d81f4a', dark:'#ff6b8b'},
crumb:'02 Knowledge · Order lifecycle',
nav:[
  {label:'TikTok Shop', href:'../TikTok Shop/tiktok-shop-order-lifecycle.html', current:true},
  {label:'Lazada', href:'../Lazada/lazada-order-lifecycle.html'},
  {label:'Shopee', href:'../Shopee/shopee-order-lifecycle.html'}
],
effects:{
  consume:{label:'กินสต๊อก', tone:'blue'},
  restore:{label:'คืนสต๊อก', tone:'green'},
  none:{label:'ไม่แตะสต๊อก (ให้คนตัดสิน)', tone:'gray'}
},
actors:{seller:'ร้าน (เรา)'},
ui:{
  outTitle:'order หนึ่งใบไปจบที่ไหนได้บ้าง',
  effectLabel:'สต๊อก', colEffect:'สต๊อก',
  apis:'API ที่คนนอกต้องใช้ตรงจุดนี้',
  basicsTitle:'ก่อนยิง API ตัวแรก — สิ่งที่คนนอกต้องจัดการ',
  mapTitle:'ตารางสถานะดิบ → สถานะภายใน (Commerce Hub)',
  mapSub:'mapping ตาม <span class="kbd">api/internal/order/status.go</span> · ค่าที่ไม่อยู่ในตาราง = <code>unknown</code> ไม่แตะสต๊อก',
  legend:{cancel:'ยกเลิก', ret:'คืนสินค้า', exc:'ปัญหาขนส่ง (ระดับพัสดุ)', back:'ย้อนกลับ'}
},
tags:{repo:'พิสูจน์ใน repo'},
footer:'สร้างจาก repo Commerce Hub ณ 2026-10-14',
lead:'สถานะอยู่ที่ <b>ระดับออเดอร์</b> (<code>status</code> ใบเดียวใช้กับทุกบรรทัด) · การยกเลิกและคืนสินค้าเป็น <b>workflow หลังการขายแยก</b> มีสถานะของตัวเอง ไม่ได้อยู่ใน order_status',
facts:[
  {k:'ระดับสถานะ', v:'ออเดอร์ (1 ค่า)'},
  {k:'Gateway', v:'<code>open-api.tiktokglobalshop.com</code>'},
  {k:'ดึงรายละเอียด', v:'1 call · ≤ 50 id'},
  {k:'Webhook ack', v:'200 body ว่าง ≤ 3 วิ'},
  {k:'Retry webhook', v:'2น. → 30น. → 3ชม. → 12ชม. แล้วเลิก'},
  {k:'สต๊อกถูกหักเมื่อ', v:'ตอนกดสั่ง (ไม่รอจ่าย)'}
],
callout:'⚠ webhook สะกดยกเลิกว่า <code>CANCEL</code> แต่ Order API ใช้ <code>CANCELLED</code> — เอกสารทางการขัดกันเอง ต้องรับทั้งสองแบบ · webhook enum ไม่มี <code>PARTIALLY_SHIPPING</code>',
rows:['ORDER STATUS — เส้นหลัก','แทรก / ระดับพัสดุ','AFTER-SALES — ยกเลิก · คืนสินค้า'],
nodes:[
 {id:'UNPAID', raw:'UNPAID', th:'สั่งแล้ว ยังไม่จ่าย', col:0, row:0, kind:'start', level:'order', mapped:'pending_payment', effect:'consume', who:['buyer'], tag:'doc',
  desc:'ผู้ซื้อกดสั่งซื้อแล้วแต่ชำระเงินยังไม่ครบ — <b>TikTok หักสต๊อกทันทีตั้งแต่ตอนนี้</b> (พิสูจน์ใน sandbox ticket 021) ระบบเราจึงต้องกินสต๊อกด้วย ไม่งั้นยอดที่ดันกลับไปจะย้อนการหักของ TikTok',
  webhook:WH('UNPAID','ครั้งแรกที่รู้ว่ามีออเดอร์'), apis:[DETAIL, SEARCH],
  gotchas:['ร้านยกเลิกออเดอร์ UNPAID ไม่ได้ — รอผู้ซื้อยกเลิกเองหรือหมดเวลาจ่าย','การดันสต๊อกต้องอ่านยอดคงเหลือใหม่ตอนหยิบงาน ห้ามใช้ตัวเลขที่คำนวณไว้ก่อนรู้ว่ามีออเดอร์ (เขียนทับ ไม่บวกซ้อน)']},
 {id:'ON_HOLD', raw:'ON_HOLD', th:'จ่ายแล้ว พักรอ', col:1, row:0, level:'order', mapped:'awaiting_fulfilment', effect:'consume', who:['platform'], tag:'doc',
  desc:'จ่ายเงินแล้ว แต่อยู่ในช่วงพักที่ผู้ซื้อยังยกเลิกเองได้ ร้านยังไม่ควรแพ็ก · ใน sandbox ออเดอร์จาก Buyer View จะขึ้นสถานะนี้',
  webhook:WH('ON_HOLD'), apis:[DETAIL, CANCEL]},
 {id:'AWAITING_SHIPMENT', raw:'AWAITING_SHIPMENT', th:'รอร้านจัดส่ง', col:2, row:0, level:'order', mapped:'awaiting_fulfilment', effect:'consume', who:['platform'], tag:'doc',
  desc:'พ้นช่วงพักแล้ว ร้านต้องแพ็กและนัดขนส่ง — นี่คือจุดที่ร้าน (หรือระบบภายนอก) ต้องลงมือ: หยิบ <code>package_id</code> จาก Get Order Detail → (ดูช่วงเวลารับของ) → Ship Package',
  webhook:WH('AWAITING_SHIPMENT'), apis:[SHIP, BATCH, DETAIL, CANCEL],
  gotchas:['Ship by TikTok ยกเลิกอัตโนมัติถ้าไม่ ready-to-ship ภายใน <b>2 วันทำการ</b>','อย่า retry ตอน timeout แบบตาบอด — อ่านสถานะ package ใหม่ก่อนยิงซ้ำ']},
 {id:'PARTIALLY_SHIPPING', raw:'PARTIALLY_SHIPPING', th:'ส่งไปบางพัสดุ', col:3.5, row:1, kind:'side', level:'order', mapped:'shipped', effect:'consume', who:['seller'], tag:'doc',
  desc:'ออเดอร์ถูกแยกหลายพัสดุและส่งไปแล้วบางส่วน · <b>ไม่มีใน webhook enum</b> จะเห็นได้จาก Order API เท่านั้น · repo แปลงเป็น shipped ทั้งใบ (สูญเสียความละเอียดระดับบรรทัด)',
  apis:[DETAIL, PKG]},
 {id:'AWAITING_COLLECTION', raw:'AWAITING_COLLECTION', th:'นัดแล้ว รอขนส่งมารับ', col:3, row:0, level:'order', mapped:'shipped', effect:'consume', who:['seller'], tag:'doc',
  desc:'ร้านนัดขนส่งแล้ว ของยังอยู่ที่ร้าน · ช่วงนี้พิมพ์ใบปะหน้า · repo แปลงเป็น shipped แม้ความหมายจริงคือ "ก่อนส่งมอบ" · ร้านยังยกเลิกได้',
  webhook:WH('AWAITING_COLLECTION'), apis:[DOC, PKG, CANCEL],
  gotchas:['ขนส่งยังไม่มารับภายใน <b>3 วันทำการ</b> → ยกเลิกอัตโนมัติ']},
 {id:'IN_TRANSIT', raw:'IN_TRANSIT', th:'ขนส่งรับของแล้ว', col:4, row:0, level:'order', mapped:'shipped', effect:'consume', who:['carrier'], tag:'doc',
  desc:'ของออกจากร้านแล้ว อยู่ระหว่างขนส่ง · ติดตามรายละเอียดระดับพัสดุด้วย Get Package Detail',
  webhook:WH('IN_TRANSIT'), apis:[PKG, DETAIL]},
 {id:'SHIP_EXCEPTION', raw:'SHIP_EXCEPTION', code:'SHIP_EXCEPTION', th:'ส่งไม่สำเร็จ / ตีกลับ', col:4.5, row:1, kind:'exc', level:'package (package_sub_status)', mapped:'— (แจ้งเตือน)', effect:'none', who:['carrier'], tag:'doc', map:false,
  desc:'ไม่ใช่ order status แต่เป็น <code>package_sub_status</code> พร้อม <code>ship_exception_reason</code> = <code>RETURNED_TO_SHIPPER</code> / <code>PACKAGE_LOST</code> / <code>PACKAGE_DAMAGAED</code> / <code>PACKAGE_SCRAP</code> · repo ใช้แค่แจ้งเตือน <b>ไม่คืนสต๊อกอัตโนมัติ</b> รอร้านยืนยันว่าได้ของคืนจริง (ticket 108)',
  apis:[PKG], gotchas:['"ส่งไม่สำเร็จ" ≠ "ของกลับถึงร้านแล้ว" — คืนสต๊อกก่อนของถึงมือ = oversell','สถานะออเดอร์ปลายทางหลังตีกลับยังไม่ได้ยืนยันใน repo']},
 {id:'DELIVERED', raw:'DELIVERED', th:'ส่งถึงผู้ซื้อ', col:5, row:0, level:'order', mapped:'delivered', effect:'consume', who:['carrier'], tag:'doc',
  desc:'ผู้ซื้อได้รับของแล้ว แต่ยัง <b>ขอคืน/คืนเงินได้</b> ภายในระยะเวลาที่กำหนด',
  webhook:WH('DELIVERED'), apis:[DETAIL, RET_SEARCH]},
 {id:'COMPLETED', raw:'COMPLETED', th:'จบสมบูรณ์', col:6, row:0, kind:'ok', level:'order', mapped:'delivered', effect:'consume', who:['platform'], tag:'doc',
  desc:'ปิดออเดอร์ — <b>ขอคืน/คืนเงินไม่ได้อีกแล้ว</b> · ยอดเงินสุทธิที่ร้านได้ (หักค่าธรรมเนียม) ต้องดูจาก Finance/Statement API ไม่ใช่ <code>payment.total_amount</code>',
  webhook:WH('COMPLETED'), apis:[DETAIL, {title:'Finance — statement / รายการเงินของออเดอร์', method:'GET', path:'/finance/202309/statements …', tag:'gen', note:'ใช้หาเงินสุทธิ/ค่าธรรมเนียม · research ระบุว่า Get Payments v202605 <b>ไม่รองรับ SEA</b> — ต้องเช็กว่า endpoint ไหนเปิดให้ไทย'}]},
 {id:'CANCELLED', raw:'CANCELLED', code:'CANCELLED / CANCEL', th:'ยกเลิกแล้ว', col:0, row:2, kind:'cancel', level:'order', mapped:'cancelled', effect:'restore', who:['buyer','seller','platform'], tag:'doc',
  desc:'ยกเลิกจบแล้ว ของไม่เคยออกจากร้าน → คืนสต๊อก · ดูผู้ยกเลิกที่ <code>cancellation_initiator</code> (เช่น SELLER) และ <code>is_buyer_request_cancel</code> · <b>Order API ส่ง CANCELLED แต่ webhook ส่ง CANCEL</b>',
  webhook:WH('CANCEL','สังเกตว่า webhook สะกด CANCEL'), apis:[DETAIL],
  gotchas:['รับทั้ง CANCEL และ CANCELLED — เลือกข้างผิด = ไม่คืนสต๊อกเลย','ยกเลิกจากร้านเพราะของหมดนับเข้า SFCR (เป้า &lt; 2.5% ย้อน 7 วัน) — ≥10% หัก AHR, ≥15% อาจโดนจำกัดยอดออเดอร์']},
 {id:'CANCEL_REQ', raw:'CANCELLATION_REQUEST_PENDING', code:'CANCEL_REQUEST', w:160, th:'มีคำขอยกเลิกค้างอยู่', col:2, row:2, kind:'cancel', level:'cancellation (แยกจาก order)', mapped:'cancel_pending', effect:'consume', who:['buyer','seller'], tag:'doc',
  desc:'สถานะของ <b>คำขอยกเลิก</b> ไม่ใช่ของออเดอร์ · ค่าที่เป็นไปได้: <code>CANCELLATION_REQUEST_PENDING</code> → <code>…_SUCCESS</code> / <code>…_CANCEL</code> (ถอนคำขอ) / <code>…_COMPLETE</code> · ระหว่างค้างยังกินสต๊อก · ถ้าร้านปฏิเสธ ออเดอร์กลับไปเดินเส้นหลักต่อ · ยึด order_status เป็นความจริงสุดท้าย',
  webhook:CANCEL_WH, apis:[CANCEL, {title:'อนุมัติ / ปฏิเสธคำขอยกเลิกของผู้ซื้อ', method:'POST', path:'/return_refund/202309/cancellations/{cancel_id}/approve | /reject', tag:'gen', note:'ผู้ซื้อขอยกเลิกบางกรณีอนุมัติอัตโนมัติ · ชื่อ path เป็นความรู้ทั่วไป ต้องตรวจเอกสาร'}]},
 {id:'RETURN_REQ', raw:'RETURN_OR_REFUND_REQUEST_PENDING', code:'RETURN_REQUEST', w:160, th:'ผู้ซื้อขอคืน/คืนเงิน', col:5, row:2, kind:'ret', level:'return (แยกจาก order)', mapped:'return_pending', effect:'consume', who:['buyer'], tag:'doc',
  desc:'ผู้ซื้อเปิดคำขอคืนสินค้าหรือคืนเงิน (ค่านี้ยืนยันจาก Create Return) · ของยังไม่กลับมา → ยังกินสต๊อก · ระหว่างทางอาจผ่าน <code>AWAITING_BUYER_SHIP</code>, <code>BUYER_SHIPPED_ITEM</code>, <code>REJECT_RECEIVE_PACKAGE</code> (ความรู้ทั่วไป ยังไม่มี enum ครบใน repo)',
  webhook:RET_WH, apis:[RET_SEARCH, {title:'ตัดสินคำขอคืน', method:'POST', path:'/return_refund/202309/returns/{return_id}/approve | /reject', tag:'gen', note:'ความรู้ทั่วไป — ตรวจชื่อ path/body ในเอกสาร Return &amp; Refund ก่อนใช้'}],
  gotchas:['repo ยังไม่ต่อ Return/Refund API — ปัจจุบันไม่มีทางไปถึง return_pending/returned ของ TikTok']},
 {id:'RETURN_DONE', raw:'RETURN_OR_REFUND_REQUEST_COMPLETE', code:'RETURN_COMPLETE', w:160, th:'คืนสินค้าเสร็จ', col:6, row:2, kind:'ok', level:'return', mapped:'returned', effect:'restore', who:['seller','platform'], tag:'gen',
  desc:'คืนเงินเสร็จ/ของกลับถึงร้าน · ถ้าเป็น REFUND อย่างเดียว (ไม่ต้องคืนของ) <b>ไม่ควรคืนสต๊อก</b> เพราะของไม่ได้กลับมา — แยกด้วย <code>return_type</code>',
  apis:[RET_SEARCH]}
],
edges:[
 {from:'UNPAID', to:'ON_HOLD', label:'จ่าย', why:'ผู้ซื้อชำระเงินสำเร็จ'},
 {from:'ON_HOLD', to:'AWAITING_SHIPMENT', label:'พ้นพัก', why:'พ้นช่วงพักที่ผู้ซื้อยกเลิกเองได้'},
 {from:'AWAITING_SHIPMENT', to:'AWAITING_COLLECTION', label:'นัดส่ง', why:'ร้านเรียก Ship Package (PICKUP / DROP_OFF)'},
 {from:'AWAITING_SHIPMENT', to:'PARTIALLY_SHIPPING', label:'ส่งบางพัสดุ', why:'ออเดอร์แยกหลายพัสดุ ส่งไปบางส่วน'},
 {from:'PARTIALLY_SHIPPING', to:'IN_TRANSIT', label:'ครบทุกพัสดุ'},
 {from:'AWAITING_COLLECTION', to:'IN_TRANSIT', label:'รับของ', why:'ขนส่งมารับ/ร้านไป drop-off แล้ว'},
 {from:'IN_TRANSIT', to:'DELIVERED', label:'ส่งถึง', why:'ขนส่งส่งถึงผู้ซื้อ'},
 {from:'DELIVERED', to:'COMPLETED', label:'ปิด', why:'พ้นระยะเวลาขอคืน/คืนเงิน'},
 {from:'IN_TRANSIT', to:'SHIP_EXCEPTION', kind:'exc', label:'ส่งไม่สำเร็จ', why:'ขนส่งแจ้ง exception ระดับพัสดุ'},
 {from:'UNPAID', to:'CANCELLED', kind:'cancel', label:'ไม่จ่าย / ผู้ซื้อยกเลิก'},
 {from:'ON_HOLD', to:'CANCEL_REQ', kind:'cancel', label:'ขอยกเลิก', why:'ผู้ซื้อหรือร้านขอยกเลิก'},
 {from:'AWAITING_SHIPMENT', to:'CANCEL_REQ', kind:'cancel', why:'ผู้ซื้อ/ร้านขอยกเลิก หรือ auto-cancel เพราะไม่ RTS ใน 2 วันทำการ'},
 {from:'AWAITING_COLLECTION', to:'CANCEL_REQ', kind:'cancel', why:'ยกเลิกก่อนขนส่งรับ หรือ auto-cancel เพราะขนส่งไม่มารับใน 3 วันทำการ'},
 {from:'CANCEL_REQ', to:'CANCELLED', kind:'cancel', label:'อนุมัติ'},
 {from:'DELIVERED', to:'RETURN_REQ', kind:'ret', label:'ขอคืน'},
 {from:'RETURN_REQ', to:'RETURN_DONE', kind:'ret', label:'เสร็จ', why:'ร้านรับของคืน/อนุมัติคืนเงิน'},
 {from:'RETURN_REQ', to:'COMPLETED', kind:'back', label:'ปฏิเสธ/ถอน', why:'คำขอถูกปฏิเสธหรือผู้ซื้อถอน ออเดอร์ปิดตามปกติ'}
],
outcomes:[
 {id:'ok', tone:'ok', label:'ส่งสำเร็จ → COMPLETED', path:['UNPAID','ON_HOLD','AWAITING_SHIPMENT','AWAITING_COLLECTION','IN_TRANSIT','DELIVERED','COMPLETED'], desc:'เส้นทางปกติ — ร้านลงมือแค่จุดเดียวคือ <b>AWAITING_SHIPMENT</b> (Ship Package + ใบปะหน้า) ที่เหลือเดินเองโดยแพลตฟอร์ม/ขนส่ง'},
 {id:'split', tone:'ok', label:'แยกหลายพัสดุ', path:['UNPAID','ON_HOLD','AWAITING_SHIPMENT','PARTIALLY_SHIPPING','IN_TRANSIT','DELIVERED','COMPLETED'], desc:'ออเดอร์ที่ TikTok แบ่งเป็นหลายพัสดุ — ต้อง Ship ทุก package_id'},
 {id:'unpaid', tone:'cancel', label:'ไม่จ่ายเงิน → CANCELLED', path:['UNPAID','CANCELLED'], desc:'ผู้ซื้อไม่จ่ายหรือยกเลิกเอง · สต๊อกที่ TikTok หักไว้ถูกคืน → ระบบเราต้องคืนด้วย'},
 {id:'cancel', tone:'cancel', label:'ยกเลิกหลังจ่าย', path:['UNPAID','ON_HOLD','AWAITING_SHIPMENT','CANCEL_REQ','CANCELLED'], desc:'ผ่านคำขอยกเลิก (CANCELLATION_STATUS_CHANGE) ก่อนจะจบที่ CANCELLED · ยกเลิกเพราะของหมดกระทบ SFCR/AHR'},
 {id:'exc', tone:'exc', label:'ขนส่งมีปัญหา / ตีกลับ', path:['UNPAID','ON_HOLD','AWAITING_SHIPMENT','AWAITING_COLLECTION','IN_TRANSIT','SHIP_EXCEPTION'], desc:'รู้จาก package_sub_status = SHIP_EXCEPTION — ยังไม่คืนสต๊อกจนกว่าร้านยืนยันว่าได้ของคืน'},
 {id:'ret', tone:'ret', label:'ผู้ซื้อขอคืน', path:['UNPAID','ON_HOLD','AWAITING_SHIPMENT','AWAITING_COLLECTION','IN_TRANSIT','DELIVERED','RETURN_REQ','RETURN_DONE'], desc:'เดินด้วย Return/Refund API แยกจากออเดอร์ — ส่วนนี้ repo ยังไม่ได้ต่อ'}
],
basics:[
 {title:'1 · เชื่อมร้าน (OAuth)', tag:'repo', body:`<ul><li>ส่งแม่ค้าไป <code>services.tiktokshop.com/open/authorize?service_id=…&amp;state=…</code> (<code>service_id</code> ≠ <code>app_key</code>)</li><li><code>code</code> ใช้ครั้งเดียว อายุ 30 นาที · แลกที่ <code>auth.tiktok-shops.com</code> (ไม่ต้องเซ็น) · <code>grant_type=authorized_code</code></li><li>access token อายุ 7 วัน · <code>*_expire_in</code> เป็น <b>timestamp สัมบูรณ์</b></li><li>แล้วเรียก <code>GET /authorization/202309/shops</code> เพื่อได้ <code>cipher</code> (ใช้ยิงออก) + <code>id</code> (webhook ส่งกลับมา) — ต้องเก็บทั้งคู่</li></ul>`,
  code:`GET https://auth.tiktok-shops.com/api/v2/token/get
    ?app_key=<app_key>&app_secret=<app_secret>
    &auth_code=<code>&grant_type=authorized_code`, codeLabel:'แลก token'},
 {title:'2 · เซ็นทุก request (202309+)', tag:'repo', body:`<ul><li>เอา query ทั้งหมด ยกเว้น <code>sign</code> / <code>access_token</code> เรียงตาม key</li><li>ต่อ <code>{key}{value}</code> เอา path นำหน้า ต่อท้ายด้วย <b>raw body byte ต่อ byte</b></li><li>ประกบหัวท้ายด้วย app_secret → HMAC-SHA256 → hex ตัวเล็ก</li><li><code>timestamp</code> = unix วินาที ห่างเวลาจริงไม่เกิน 5 นาที · token อยู่ header <code>x-tts-access-token</code></li></ul>`,
  code:`base = app_secret + path + "app_key…shop_cipher…timestamp…" + raw_body + app_secret
sign = hex(HMAC-SHA256(key = app_secret, base))`, codeLabel:'สูตร'},
 {title:'3 · สมัคร webhook ต่อร้าน ต่อ topic', tag:'repo', body:`<p>ชุดขั้นต่ำ: <code>ORDER_STATUS_CHANGE</code>, <code>CANCELLATION_STATUS_CHANGE</code>, <code>SELLER_DEAUTHORIZATION</code>, <code>UPCOMING_AUTHORIZATION_EXPIRATION</code> · URL ต้อง HTTPS / TLS1.2+ / โดเมน ไม่ใช่ IP / ห้ามระบุ port · หน้า Manage Webhook ใน console อาจโชว์ว่างทั้งที่สมัครผ่าน API แล้ว — เชื่อผล GET API</p>`,
  code:`PUT /event/202309/webhooks?shop_cipher=…&app_key=…&timestamp=…&sign=…

{ "address": "https://example.com/webhooks/tiktok", "event_type": "ORDER_STATUS_CHANGE" }`, codeLabel:'Update Shop Webhook'},
 {title:'4 · อ่านผลลัพธ์ให้ถูก', tag:'doc', body:`<ul><li>ทุก response มี <code>code</code> (int, 0 = สำเร็จ), <code>message</code>, <code>request_id</code>, <code>data</code></li><li><b>code 0 ไม่ได้แปลว่าผ่านทุกรายการ</b> — API แบบ batch มี <code>data.errors[]</code></li><li>throttle: HTTP 429 และ/หรือ <code>36009002</code> (อาจมากับ HTTP 200) → ทำตาม Retry-After หรือ backoff + jitter · 503 ไม่ใช่ throttle</li></ul>`},
 {title:'5 · Reconcile เป็นภาคบังคับ', tag:'repo', body:`<p>TikTok บอกเองว่า webhook ไม่ใช่แหล่งความจริงเดียว · retry 4 ครั้งแล้วเลิก · ต้องมีรอบกวาด Search Orders ตาม <code>update_time</code> (repo ใช้ช่วงละ 7 วัน เพราะยังไม่รู้เพดานจริง) แล้วดึง Detail ทีละ ≤ 50</p>`}
],
sources:['<code>.wayfinder/research/tiktok-shop-api.md</code>, <code>order-detail-api.md</code>, <code>status-normalization.md</code> (ticket 079), <code>marketplace-fulfillment-contract.md</code> (ticket 101)','<code>api/internal/order/status.go</code>, <code>db/migrations/0006_order_model.up.sql</code>','โน้ตคู่กัน: <code>tiktok-shop-lifecycle.md</code> ในโฟลเดอร์เดียวกัน']
};
})();
