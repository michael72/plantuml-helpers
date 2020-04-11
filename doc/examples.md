## Examples

### Circular dependencies

```plantuml
@startuml
title Unordered
[A] -> [B]
[B] -> [C]
[C] -> [D]
[D] -> [A]
[G] -> [B]
[D] -> [H]
@enduml
```

```plantuml
title auto formatted
@startuml
[G] -> [B]
[A] -> [B]
[C] -> [D]
[D] -> [A]
[D] -> [H]
[B] -> [C]
@enduml
```

```plantuml
@startuml
title Ordered - no change in direction
[G] -> [B]
[B] -> [C]
[C] -> [D]
[D] -> [A]
[A] -> [B]
[D] -> [H]
@enduml
```

```plantuml
title Ordered - with change in direction
[G] -> [B]
[B] --> [C]
[C] -> [D]
[A] <-- [D]
[B] <- [A]
[D] -> [H]
``` 

### Simple circles
```plantuml
@startuml
title 4 nodes
[A] -> [B]
[B] --> [C]
[D] <- [C]
[A] <-- [D]
@enduml
```
```plantuml
@startuml
title 5 nodes
[A] -> [B]
[B] -> [C]
[C] --> [D]
[E] <- [D]
[A] <-- [E]
@enduml
```
```plantuml
@startuml
title 6 nodes
[A] -> [B]
[B] -> [C]
[C] --> [D]
[E] <- [D]
[F] <- [E]
[A] <-- [F]
@enduml
```

### Inheritance and Composition
Inheritance should preferably go vertical (derived up to base) while composition goes horizontal (container left, element right).
```plantuml
@startuml
    IFoo o-> IBase
    IFoo <|-- [Foo] 
    [Foo] o-> [Proxy]
    [Proxy] o-> [MyDerived1] 
    IBase <-o [Base]
    [Base] <|--- [MyDerived1]  
    [Base] <|-- [MyDerived2]
    IBase <|-- [Derived] 
    [Derived] o-> Db
    [ImageSource] o-> [MyDerived2]
@enduml
```
