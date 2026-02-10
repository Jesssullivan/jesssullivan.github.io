---
title: "Decentralized Pi Video Monitoring w/ motioneye & BATMAN"
date: "2019-09-30"
description: "Visit the me here on Github Added parabolic musings 10/16/19, see below ...On using motioneye video clients on Pi Zeros & Raspbian over a BATMAN-adv Ad-Hoc..."
tags: ["DIY", "Featured", "Ideas"]
published: true
slug: "decentralized-pi-video-monitoring-w-motioneye-batman"
original_url: "https://transscendsurvival.org/2019/09/30/decentralized-pi-video-monitoring-w-motioneye-batman/"
---

[Visit the me here on Github](https://github.com/Jesssullivan/motioneye-mesh)  
_Added parabolic musings 10/16/19, see below_

**_...On using motioneye video clients on Pi Zeros & Raspbian over a BATMAN-adv Ad-Hoc network_**

[link: motioneyeos](https://github.com/ccrisan/motioneyeos/wiki)  
[link: motioneye Daemon](https://github.com/ccrisan/motioneye/wiki)  
[link: Pi Zero W Tx/Rx data sheet:](https://www.cypress.com/file/298756/download#page=28&zoom=100,0,184)  
[link: BATMAN Open Mesh](https://www.open-mesh.org/projects/open-mesh/wiki)

This implementation of motioneye is running on Raspbian Buster (opposed to motioneyeos). 

**Calculating Mesh Effectiveness w/ Python:**  
Please take a look at dBmLoss.py- the idea here is one should be able to estimate the maximum plausible distance between mesh nodes before setting anything up. It can be run with no arguments-
    
    
    python3 dBmLoss.py

...with no arguments, it should use default values (Tx = 20 dBm, Rx = |-40| dBm) to print this: 
    
    
    you can add (default) Rx Tx arguments using the following syntax:
                     python3 dBmLoss.py 20 40
                     python3 dBmLoss.py &lt;Rx> &lt;Tx>                 
    
     57.74559999999994 ft = max. mesh node spacing, @
     Rx = 40
     Tx = 20

_Regarding the Pi:  
_The Pi Zero uses an onboard BCM43143 wifi module. See above for the data sheet. We can expect around a ~19 dBm Tx signal from a BCM43143 if we are optimistic. Unfortunately, "usable" Rx gain is unclear in the context of the Pi.

_Added 10/16/19:_  
Notes on generating an **accurate** parabolic antenna shape with FreeCAD’s Python CLI: 

For whatever reason, (likely my own ignorance) I have been having trouble generating an accurate parabolic dish shape in Fusion 360 (AFAICT, Autodesk is literally drenching Fusion 360 in funds right now, I feel obligated to at least try). Bezier, spline, etc curves are not suitable!  
If you are not familiar with FreeCAD, the general approach- geometry is formed through fully constraining sketches and objects- is quite different from Sketchup / Tinkercad / Inventor / etc, as most proprietary 3d software does the “constraining” of your drawings behind the scenes. From this perspective, you can see how the following script never actually defines or changes the curve / depth of the parabola; all we need to do is change how much curve to include. A wide, shallow dish can be made by only using the very bottom of the curve, or a deep / narrow dish by including more of the ever steepening parabolic shape.
    
    
    import Part, math
    
    # musings derived from:
    # https://forum.freecadweb.org/viewtopic.php?t=4430
    
    # thinking about units here:
    tu = FreeCAD.Units.parseQuantity
    
    def mm(value):
        return tu('&#123;&#125; mm'.format(value))
    
    rs = mm(1.9)
    thicken = -(rs / mm(15)) 
    
    # defer to scale during fitting / fillet elsewhere 
    m=App.Matrix()
    m.rotateY(math.radians(-90))
    # create a parabola with the symmetry axis (0,0,1)
    parabola=Part.Parabola()
    parabola.transform(m)
    
    # get only the right part of the curve
    edge=parabola.toShape(0,rs)
    pt=parabola.value(rs)
    line=Part.makeLine(pt,App.Vector(0,0,pt.z))
    wire=Part.Wire([edge,line])
    shell=wire.revolve(App.Vector(0,0,0),App.Vector(0,0,1),360)
    
    # make a solid
    solid=Part.Solid(shell)
    
    # apply a thickness
    thick=solid.makeThickness([solid.Faces[1]],thicken,0.001)
    Part.show(thick)
    
    Gui.SendMsgToActiveView("ViewFit")
    
    """
    # Fill screen:
    Gui.SendMsgToActiveView("ViewFit")
    # Remove Part in default env:
    App.getDocument("Unnamed1").removeObject("Shape")
    """

**FWIW, here is my Python implimentation of a Tx/Rx "Free Space" distance calulator-**  
_dBmLoss.py:_
    
    
    from math import log10
    from sys import argv
    '''
    # estimate free space dBm attenuation:
    # ...using wfi module BCM43143:
    
    Tx = 19~20 dBm
    Rx = not clear how low we can go here
    
    d = distance Tx --> Rx
    f = frequency
    c = attenuation constant: meters / MHz = -27.55; see here for more info:
    https://en.wikipedia.org/wiki/Free-space_path_loss
    '''
    
    f = 2400  # MHz
    c = 27.55 # RF attenuation constant (in meters / MHz)
    
    def_Tx = 20  # expected dBm transmit
    def_Rx = 40  # (absolute value) of negative dBm thesh
    
    def logdBm(num):
        return 20 * log10(num)
    
    def maxDist(Rx, Tx):
        dBm = 0
        d = .1  # meters!
        while dBm &lt; Tx + Rx:
            dBm = logdBm(d) + logdBm(f) - Tx - Rx + c
            d += .1  # meters!
        return d
    
    # Why not use this with arguments Tx + Rx from shell if we want:
    def useargs():
        use = bool
        try:
            if len(argv) == 3:
                use = True
            elif len(argv) == 1:
                print('\n\nyou can add (default) Rx Tx arguments using the following syntax: \n \
                    python3 dBmLoss.py 20 40 \n \
                    python3 dBmLoss.py &lt;Rx> &lt;Tx> \
                    \n')
                use = False
            else:
                print('you must use both Rx & Tx arguments or no arguments')
                raise SystemExit
        except:
            print('you must use both Rx & Tx arguments or no arguments')
            raise SystemExit
        return use
    
    def main():
    
        if useargs() == True:
            arg = [int(argv[1]), int(argv[2])]
        else:
            arg = [def_Rx, def_Tx]
    
        print(str('\n ' + str(maxDist(arg[0], arg[1])*3.281) + \
            ' ft = max. mesh node spacing, @ \n' + \
            ' Rx = ' + str(arg[0]) + '\n' + \
            ' Tx = ' + str(arg[1])))
    
    main()

### _Related_
