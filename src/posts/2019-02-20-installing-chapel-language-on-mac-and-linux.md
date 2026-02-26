---
title: "Musings On Chapel Language and Parallel Processing"
date: "2019-02-20"
description: "View below the readme mirror from my Github repo. Scroll down for my Python3 evaluation script. ....Or visit the page directly:..."
tags: ["Featured", "Ideas", "How-To"]
published: true
slug: "installing-chapel-language-on-mac-and-linux"
original_url: "https://transscendsurvival.org/2019/02/20/installing-chapel-language-on-mac-and-linux/"
feature_image: "/images/posts/IMG_2363-Edit.jpg"
---

View below the readme mirror from my Github repo. Scroll down for my Python3 evaluation script.

....Or visit the page directly: [https://github.com/Jesssullivan/ChapelTests ](https://github.com/Jesssullivan/ChapelTests)

# ChapelTests

Investigating modern concurrent programming ideas with Chapel Language and Python 3

**See here for dupe detection:** [/FileChecking-with-Chapel](https://github.com/Jesssullivan/ChapelTests/tree/master/FileChecking-with-Chapel)

**Iterating through all files for custom tags / syntax:** [/GenericTagIterator](https://github.com/Jesssullivan/ChapelTests/tree/master/GenericTagIterator)

added 9/14/19:

The thinking here is one could write a global, shorthand / tag-based note manager making use of an efficient tag gathering tool like the example here. Gone are the days of actually needing a note manager- when the need presents itself, one could just add a calendar item, todo, etc with a global tag syntax.

The test uses $D for date: `$D 09/14/19`

    //  Chapel-Language  //

    // non-annotated file @ /GenericTagIterator/nScan.chpl //

    use FileSystem;
    use IO;
    use Time;

    config const V : bool=true;  // verbose logging, currently default!

    module charMatches {
      var dates = {("")};
    }

    // var sync1$ : sync bool=true;  not used in example- TODO: add sync$ var back in!!

    proc charCheck(aFile, ref choice, sep, sepRange) {

        // note, reference argument (ref choice) is needed if using Chapel structure "module.domain"

        try {
            var line : string;
            var tmp = openreader(aFile);
            while(tmp.readline(line)) {
                if line.find(sep) > 0 {
                    choice += line.split(sep)[sepRange];
                    if V then writeln('adding '+ sep + ' ' + line.split(sep)[sepRange]);
                }
            }
        tmp.close();
        } catch {
          if V then writeln("caught err");
        }
    }

    coforall folder in walkdirs('check/') {
        for file in findfiles(folder) {
            charCheck(file, charMatches.dates, '$D ', 1..8);
        }
    }

# Get some Chapel:

In a (bash) shell, install Chapel:
Mac or Linux here, others refer to:

https://chapel-lang.org/docs/usingchapel/QUICKSTART.html

    # For Linux bash:
    git clone https://github.com/chapel-lang/chapel
    tar xzf chapel-1.18.0.tar.gz
    cd chapel-1.18.0
    source util/setchplenv.bash
    make
    make check

    #For Mac OSX bash:
    # Just use homebrew
    brew install chapel # :)

# Get atom editor for Chapel Language support:

    #Linux bash:
    cd
    sudo apt-get install atom
    apm install language-chapel
    # atom [yourfile.chpl]  # open/make a file with atom

    # Mac OSX (download):
    # https://github.com/atom/atom
    # bash for Chapel language support
    apm install language-chapel
    # atom [yourfile.chpl]  # open/make a file with atom

# Using the Chapel compiler

To compile with Chapel:

    chpl MyFile.chpl # chpl command is self sufficient

    # chpl one file class into another:

    chpl -M classFile runFile.chpl

    # to run a Chapel file:
    ./runFile

# Now Some Python3 Evaluation:

    # Ajacent to compiled FileCheck.chpl binary:

    python3 Timer_FileCheck.py

Timer_FileCheck.py will loop FileCheck and find the average times it takes to complete, with a variety of additional arguments to toggle parallel and serial operation. The iterations are:

    ListOptions = [Default, Serial_SE, Serial_SP, Serial_SE_SP]

  * Default - full parallel

  * Serial evaluation (--SE) but parallel domain creation

  * Serial domain creation (--SP) but parallel evaluation

  * Full serial (--SE --SP)

# [](https://github.com/Jesssullivan/ChapelTests/tree/master/ChapelTesting-Python3#output-is-saved-as-time_filecheck_resultstxt)Output is saved as Time_FileCheck_Results.txt

  * Output is also logged after each of the (default 10) loops.

The idea is to evaluate a "--flag" -in this case, Serial or Parallel in FileCheck.chpl- to see of there are time benefits to parallel processing. In this case, there really are not any, because that program relies mostly on disk speed.

## Evaluation Test:

    # Time_FileCheck.py
    #
    # A WIP by Jess Sullivan
    #
    # evaluate average run speed of both serial and parallel versions
    # of FileCheck.chpl  --  NOTE: coforall is used in both BY DEFAULT.
    # This is to bypass the slow findfiles() method by dividing file searches
    # by number of directories.

    import subprocess
    import time

    File = "./FileCheck" # chapel to run

    # default false, use for evaluation
    SE = "--SE=true"

    # default false, use for evaluation
    SP = "--SP=true" # no coforall looping anywhere

    # default true, make it false:
    R = "--R=false"  #  do not let chapel compile a report per run

    # default true, make it false:
    T = "--T=false" # no internal chapel timers

    # default true, make it false:
    V = "--V=false"  #  use verbose logging?

    # default is false
    bug = "--debug=false"

    Default = (File, R, T, V, bug) # default parallel operation
    Serial_SE = (File, R, T, V, bug, SE)
    Serial_SP = (File, R, T, V, bug, SP)
    Serial_SE_SP = (File, R, T, V, bug, SP, SE)

    ListOptions = [Default, Serial_SE, Serial_SP, Serial_SE_SP]

    loopNum = 10 # iterations of each runTime for an average speed.

    # setup output file
    file = open("Time_FileCheck_Results.txt", "w")

    file.write(str('eval ' + str(loopNum) + ' loops for ' + str(len(ListOptions)) + ' FileCheck Options' + "\n\\"))

    def iterateWithArgs(loops, args, runTime):
        for l in range(loops):
            start = time.time()
            subprocess.run(args)
            end = time.time()
            runTime.append(end-start)

    for option in ListOptions:
        runTime = []
        iterateWithArgs(loopNum, option, runTime)
        file.write("average runTime for FileCheck with "+ str(option) + "options is " + "\n\\")
        file.write(str(sum(runTime) / loopNum) +"\n\\")
        print("average runTime for FileCheck with " + str(option) + " options is " + "\n\\")
        print(str(sum(runTime) / loopNum) +"\n\\")

    file.close()
