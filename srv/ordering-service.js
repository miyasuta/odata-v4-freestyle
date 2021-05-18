const cds = require('@sap/cds')

const checkDeliveryDate = function (req) {
    const deliveryDateTime = new Date(`${req.data.date} ${req.data.time}`)
    if (deliveryDateTime < new Date()) {
        return req.error (409, `Delivery date time must not be past`)
    }
}

const setTotalAmount = async function (req, to_parent_ID, itemAmount) {
    //calculate total amount
    //1. get all items belonging to the same parent order
    const q3 =  SELECT.one.from `OrderingService_OrderItems_drafts`
    .columns `{sum(amount) as restAmount}`
    .where `to_parent_ID = ${to_parent_ID} and ID <> ${req.data.ID}`
    const {restAmount} = await cds.tx(req).run(q3)
    const totalAmount = itemAmount + restAmount

    //2. set total amount to header
    const q4 = UPDATE `OrderingService_Orders_drafts` .set `totalAmount = ${totalAmount}`
                .where `ID = ${to_parent_ID}`
    return cds.tx(req).run(q4)
}

module.exports = function () {
    const { Orders, OrderItems } = cds.entities

    //Event handlers for Orders
    this.before('CREATE', 'Orders', async (req) => {
        checkDeliveryDate(req)

        //select max orderId from table
        console.log(`CREATE handler was called: ${JSON.stringify(req.data)}`)
        const q = SELECT.one.from(Orders).columns `{max(orderId) as maxOrderId}`
        const {maxOrderId} = await cds.tx(req).run(q)
        req.data.orderId = maxOrderId + 1
        req.data.to_status_ID = 1

        //set item numbers
        if (req.data.to_items) {
            req.data.to_items.forEach((item, index) => {
                item.itemNumber = index + 1
            })
        }
    })

    this.before('UPDATE', 'Orders', (req) => {
        checkDeliveryDate(req)
    })    

    //Event handlers for OrderItems
    this.before('PATCH', 'OrderItems', async (req) => {
        console.log(`PATCH handler was called: ${JSON.stringify(req.data)}`)    
        
        //get draft data from table
        const q1 = SELECT.one.from `OrderingService_OrderItems_drafts`
        .columns `{itemNumber, to_parent_ID, quantity as originalQuantity, price as originalPrice}`.where `ID = ${req.data.ID}`
        const {itemNumber, to_parent_ID, originalQuantity, originalPrice} = await cds.tx(req).run(q1)  
        
        //set Item number (if initial)
        if(!itemNumber) {
            const q2 = SELECT.one.from `OrderingService_OrderItems_drafts`
            .columns `{max(itemNumber) as maxItemNum}`
            //.where `to_parent_ID = ${SELECT.one.from `OrderingService_OrderItems_drafts`.columns `{to_parent_ID}`.where `ID = ${req.data.ID}`}`
            .where `to_parent_ID = ${to_parent_ID}`
            const {maxItemNum} = await cds.tx(req).run(q2)
            req.data.itemNumber = maxItemNum + 1
        }

        //when quantity or price have been changed
        if (req.data.quantity || req.data.price) {
            //get original quantity and price from draft table      
            const quantity = req.data.quantity ? req.data.quantity : originalQuantity
            const price = req.data.price ? req.data.price : originalPrice

            //calculate new amount
            req.data.amount = quantity * price
            await setTotalAmount(req, to_parent_ID, req.data.amount)   
        }
    })   

    this.on('CANCEL', 'OrderItems', async (req, next) => {
        //get parent id from table
        const q1 = SELECT.one.from `OrderingService_OrderItems_drafts`
        .columns `{to_parent_ID}`.where `ID = ${req.data.ID}`
        const {to_parent_ID} = await cds.tx(req).run(q1)      
        await next() 
        await setTotalAmount(req, to_parent_ID, 0) //exclude deleted item amount   
    })    
}

