# Networking Chapter 8 source review

Chapter 8, “Network Hardware in Depth,” explains how devices make forwarding decisions and which features help a network stay available under load or after a failure. The supplied text starts mid-case at extraction page 340 and ends the chapter at extraction page 387, corresponding to printed pages 321–368.

- **Switches.** A Layer 2 switch learns source MAC addresses and uses destination addresses to forward frames within a VLAN. The chapter compares forwarding latency with error checking, explains how spanning tree keeps redundant links usable without creating loops, and shows how trunks carry traffic for several VLANs over one link.
- **Routers.** Routers move packets between IP networks and rebuild the Ethernet frame for the outgoing link. Route selection involves separate decisions about path cost and the source of routing information. RIP and OSPF make different choices when hop count and link cost point to different paths. The chapter also explains how ACLs control which traffic crosses an interface.
- **Cisco IOS.** The console gives local management access. The prompt identifies the command mode, and the startup configuration determines which saved settings are loaded when the device reboots.
- **Wireless access points.** The radio mode, channel, and SSID shape how clients find and join the network. Encryption, enterprise authentication, and client isolation address different security needs. Repeater and bridge modes solve different connectivity problems, while Target Wake Time and OFDMA improve airtime use.
- **Network interface cards.** Bus and media compatibility determine whether a NIC fits a system. Buffering and bus mastering affect data handling, failover maintains connectivity, and Wake-on-LAN and PXE serve distinct purposes before ordinary network use.

## Source map

Ranges below use the IDs in the library with the shared `networking-chapter-8-` prefix omitted. Page numbers refer to the extraction markers.

| Quiz questions | Terminology | Chapter section and extraction pages |
| --- | --- | --- |
| q001–q004 | term001–term005 | Switch Port Modes of Operation and Creating the Switching Table, pp. 341–343 |
| q005–q006 | term006–term008 | Frame Forwarding Methods and Table 8-1, pp. 343–344 |
| q007–q010 | term009–term013 | Multicast Processing and Spanning Tree Protocol, pp. 344–346 |
| q011–q014 | term014–term016, term020 | VLANs, VLAN Trunks, Switch Port Security, and Multilayer Switches, pp. 346–350 |
| q015–q016 | term017–term019 | Port Aggregation and Types of Switch Ports, pp. 348–349 |
| q017–q020 | term021–term025 | Routers in Depth, Router Interfaces, and Routing Tables, pp. 352–355 |
| q022–q026 | term028–term034 | Routing Protocols and Interior Gateway versus Exterior Gateway, pp. 356–358 |
| q021, q027–q029 | term026–term027, term035 | Static vs. Dynamic Routing, Access Control Lists, and Case Project 8-3, pp. 358–359, 385–386 |
| q030–q034 | term036–term039 | Using the Cisco Command Line Interface, pp. 361–364 |
| q035–q039 | term040–term043 | Basic Wireless Settings, Wireless Security Options, and Advanced Wireless Settings, pp. 365–367 |
| q040–q042 | term044–term047 | Advanced Wireless Settings, pp. 367–368 |
| q043–q044 | term048 | PC Bus Options, pp. 368–369 |
| q045–q050 | term049–term054 | Advanced Features of NICs, pp. 370–371 |

## Source decisions

- The narrative and chapter summary give different starting modes for adaptive switching. The quiz covers the three forwarding methods individually and omits the disputed starting mode.
- The PCI bandwidth figures in the prose and the comparison table differ. The bus questions cover interface selection and lane count.
- The activities use readable text and self-check explanations. Extracted diagrams, lab steps, and packet captures are unnecessary to answer the questions. Extraction pages 388–389 belong to Chapter 9 and fall outside this study set.
