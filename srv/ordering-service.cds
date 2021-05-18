using { demo.ordering as demo } from '../db/schema';
service OrderingService {
    @odata.draft.enabled
    entity Orders as projection on demo.Orders;    
    entity OrderItems as projection on demo.OrderItems;    

    @readonly
    entity Statuses as projection on demo.Statuses;
}

